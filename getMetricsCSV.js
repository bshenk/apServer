var assert = require('assert')
const fs = require('fs')
var MongoClient = require('mongodb').MongoClient

function formatDate(date) {
  return `${date.getMonth()+1}-${date.getDate()}-${date.getFullYear()}`
}

function getMetricsCSV (config, users) {
  if (!config || !users) {
    if (!config) console.error('[connectToMongo] No config was sent.')
    if (!users) console.error('[connectToMongo] No user data was sent.')
    return
  }

  return new Promise ((resolve, reject) => {
    var url = `mongodb://${config.userName}:${config.password}@${config.host}:${config.port}/?authMechanism=DEFAULT&authSource=${config.authDB}`

    var midnight = new Date();
    var oneWeekAgo = new Date();
    // midnight.setDate(14) // REMOVE THIS, TESTING ONLY
    midnight.setHours(0,0,0,0);
    oneWeekAgo.setDate(midnight.getDate() - 7);
    
    var projectsCount    = {}
    var projectsPastWeek = {}
    var actionsCount     = {}
    var actionsPastWeek  = {}
    var activeProjectsPastWeek = {}
    var loginsPastWeek = {}
    
    var csv = []
    csv.push(["", "PatentID User Metrics"])
    csv.push([formatDate(midnight)])
    csv.push(["", "", "", "", "", "", "", "Lifetime Activity (Since Signup)", "", "", "", "Recent Activity (Last 7 Days)"])
    csv.push([
      "User Name", 
      "Email", 
      "Promo", 
      "Date of Sign Up", 
      "# of Days Since Sign Up", 
      "# of Days Since Last Login",
      "",
      "# of Logins Since Sign Up",
      "# of Projects Active Since Sign Up",
      "# of Actions Since Sign Up",
      "",
      "# of Logins Last 7 Days", 
      "# of Projects Active Last 7 Days", 
      "# of Actions Last 7 Days", 
    ])  
  
    MongoClient.connect(url, { useNewUrlParser: true }, async function(err, db) {
      assert.equal(null, err);
  
      var mainDB = db.db(config.db)
      var activeToday    = false;
      var activePastWeek = false;
      
      var todayData = {
        newUsersToday: 0,
        newProjectsToday: 0,
        activeProjectsToday: 0,
      }
  
      // Fillilng in initial user metrics with data from the frontend
      for(var user in users) {
        if(users.hasOwnProperty(user)) {
          var {
            _id,
            email,
            promo,
            createdAt,
            daysSinceSignUp,
            daysSinceLastLogin,
            logins,
            totalLogins
          } = users[user]

          logins = logins || []

          if (daysSinceLastLogin === null) daysSinceLastLogin = 'No logins recorded.'

          if(new Date(createdAt).getTime() >= midnight) { todayData.newUsersToday++ }
  
          projectsCount[_id]          = 0
          projectsPastWeek[_id]       = 0
          actionsCount[_id]           = 0
          actionsPastWeek[_id]        = 0
          activeProjectsPastWeek[_id] = 0
          loginsPastWeek[_id]         = 0
  
          csv.push([
            _id, 
            email, 
            promo, 
            formatDate(new Date(createdAt)), 
            daysSinceSignUp,
            daysSinceLastLogin,
            "",
            totalLogins,
            0, // total projects: index 8
            0, // total actions: index 9,
            "",
            logins.map(login => login > oneWeekAgo.getTime()).length, // logins last week: index 11
            0, // projects last week: index 12
            0, // actions last week: index 13
          ])
        }
      }
  
      var projects = await mainDB.collection(config.collection).find().toArray(function(err, result) {
        if (err) reject(err)

        result.forEach(document => {
          let projectActivePastWeek = false

          // Getting total number of projects for each user
          if(projectsCount.hasOwnProperty(document.userHash)){
            projectsCount[document.userHash]++
          }
  
          Object.keys(document.history).forEach(key => {
            var action = document.history[key]
            var happenedToday = action.mTimeStamp > midnight.getTime()
            var happenedPastWeek = action.mTimeStamp > oneWeekAgo.getTime()
            var newProjectAction = action.command === 'startInvestigation'

            actionsCount[document.userHash]++

            if (happenedPastWeek) { 
              actionsPastWeek[document.userHash]++
              projectActivePastWeek = true
            }
  
            if(newProjectAction){
              if(happenedToday){
                todayData.newProjectsToday++
              }
              if(happenedPastWeek){
                if(projectsPastWeek.hasOwnProperty(document.userHash)){
                  projectsPastWeek[document.userHash]++
                }
              }
            } 
  
            // Projects Active Today
            if (happenedToday){ activeToday = true; }
          })

          if (projectActivePastWeek) activeProjectsPastWeek[document.userHash]++
  
          if(activeToday){
            todayData.activeProjectsToday++;
            activeToday = false;
          }

          // Filling in missing user data here
          for(var outer = 0; outer < csv.length; outer++){
            if(csv[outer][0] === document.userHash){
              csv[outer][8] = projectsCount[document.userHash]
              csv[outer][9] = actionsCount[document.userHash]
              csv[outer][12] = projectsPastWeek[document.userHash]
              csv[outer][13] = actionsPastWeek[document.userHash]
            }
          }
        })

        // Adding daily metrics
        // csv[2] = ["", "", "", "", todayData.newUsersToday, todayData.activeProjectsToday]
  
        // close db connection now that we're done with the query
        db.close()

        resolve(csv)
      })
    })
  })
}

module.exports = {
  getMetricsCSV
}
