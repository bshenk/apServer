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
    var url = `mongodb://${config.userName}:${config.password}@localhost:${config.port}/?authMechanism=DEFAULT&authSource=${config.authDB}`

    var midnight = new Date();
    var oneWeekAgo = new Date();
    // midnight.setDate(14) // REMOVE THIS, TESTING ONLY
    midnight.setHours(0,0,0,0);
    oneWeekAgo.setDate(midnight.getDate() - 7);

    var actionsCount            = {}
    var projectsCount           = {}
    
    var actionsPastWeek         = {}
    var activeProjectsPastWeek  = {}

    var actionsToday            = {}
    var activeProjectsToday     = {}
    
    var csv = []
    csv.push([
      "", "", "", "", "", "", "", 
      "Lifetime Activity (Since Signup)", 
      "", "", "", 
      "Recent Activity (Last 7 Days)", 
      "", "", "", 
      "Recent Activity (Today)"
    ])
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
      "",
      "# of Logins Today",
      "# of Projects Active Today",
      "# of Actions Today"
    ])
  
    MongoClient.connect(url, { useNewUrlParser: true }, async function(err, db) {
      assert.equal(null, err);
  
      var mainDB = db.db(config.db)
      
      var userSignupData = {
        newUsersToday: 0,
        newUsersLastWeek: 0,
        totalUsers: 0
      }

      let totals = {
        daysSinceLastLogin: 0,
        daysSinceSignUp: 0,
        
        logins: 0,
        activeProjects: 0,
        actions: 0,

        weeklyLogins: 0,
        weeklyActiveProjects: 0,
        weeklyActions: 0,

        dailyLogins: 0,
        dailyActiveProjects: 0,
        dailyActions: 0
      }

      let userIds = users.map(user => user._id)
  
      // Fillilng in initial user metrics with data from the frontend
      for(var user in users) {
        if(users.hasOwnProperty(user)) {
          let {
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

          let loginsLastWeek = 0
          let loginsToday = 0

          logins.forEach(login => {
            if (login >= midnight.getTime()) loginsToday++
            if (login >= oneWeekAgo.getTime()) loginsLastWeek++
          })

          // add to totals
          totals.daysSinceLastLogin = totals.daysSinceLastLogin + daysSinceLastLogin
          totals.daysSinceSignUp = totals.daysSinceSignUp + daysSinceSignUp
          totals.logins = totals.logins + logins.length
          totals.dailyLogins = totals.dailyLogins + loginsToday
          totals.weeklyLogins = totals.weeklyLogins + loginsLastWeek
          
          // Edit userSignupData
          userSignupData.totalUsers++
          if (new Date(createdAt).getTime() >= midnight) userSignupData.newUsersToday++ 
          if (new Date(createdAt).getTime() >= oneWeekAgo) userSignupData.newUsersLastWeek++
  
          projectsCount[_id]          = 0
          actionsCount[_id]           = 0

          actionsPastWeek[_id]        = 0
          activeProjectsPastWeek[_id] = 0

          actionsToday[_id]           = 0
          activeProjectsToday[_id]    = 0


          if (totalLogins === 0) {
            daysSinceLastLogin = ''
            totalLogins = ''
            loginsLastWeek = ''
            loginsToday = ''
          }
  
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
            loginsLastWeek, // logins last week: index 11
            0, // projects last week: index 12
            0, // actions last week: index 13,
            "",
            loginsToday, // logins today: index 15
            0, // active projects today: index 16
            0, // actions today: index 17
          ])
        }
      }
  
      var projects = await mainDB.collection(config.collection).find().toArray(function(err, result) {
        if (err) reject(err)


        result.forEach(document => {
          let projectActivePastWeek = false
          let projectActiveToday = false

          // Getting total number of projects for each user
          if(projectsCount.hasOwnProperty(document.userHash)){
            projectsCount[document.userHash]++
          }
  
          Object.keys(document.history).forEach(key => {
            var action = document.history[key]
            var happenedToday = action.mTimeStamp > midnight.getTime()
            var happenedPastWeek = action.mTimeStamp > oneWeekAgo.getTime()

            actionsCount[document.userHash]++

            // Don't add actions from old users
            if (userIds.indexOf(document.userHash) > -1) totals.actions++

            if (happenedPastWeek) { 
              actionsPastWeek[document.userHash]++
              totals.weeklyActions++
              projectActivePastWeek = true
            }

            if (happenedToday) {
              actionsToday[document.userHash]++
              totals.dailyActions++
              projectActiveToday = true
            }
          })

          // Don't add projects from old users
          if (userIds.indexOf(document.userHash) > -1) totals.activeProjects++

          if (projectActivePastWeek) {
            activeProjectsPastWeek[document.userHash]++
            totals.weeklyActiveProjects++
          }

          if (projectActiveToday) {
            activeProjectsToday[document.userHash]++
            totals.dailyActiveProjects++
          } 

          // Filling in missing user data here
          for(var outer = 0; outer < csv.length; outer++){
            if(csv[outer][0] === document.userHash){
              csv[outer][8] = projectsCount[document.userHash]
              csv[outer][9] = actionsCount[document.userHash]

              csv[outer][12] = activeProjectsPastWeek[document.userHash]
              csv[outer][13] = actionsPastWeek[document.userHash]

              csv[outer][16] = activeProjectsToday[document.userHash]
              csv[outer][17] = actionsToday[document.userHash]
            }
          }
        })

        let averages = {}
        Object.keys(totals).forEach(key => {
          averages[key] = (totals[key] / users.length).toFixed(2)
        })

        // Adding empty row before totals/averages
        csv[csv.length] = []

        // Adding totals
        csv[csv.length] = [
          "", 
          "Total",
          "", "", "", "", "",
          totals.logins,
          totals.activeProjects,
          totals.actions,
          "",
          totals.weeklyLogins,
          totals.weeklyActiveProjects,
          totals.weeklyActions,
          "",
          totals.dailyLogins,
          totals.dailyActiveProjects,
          totals.dailyActions
        ]
        
        // Adding averages
        csv[csv.length] = [
          "", 
          "Average/User",
          "", "",
          averages.daysSinceSignUp,
          averages.daysSinceLastLogin,
          "",
          averages.logins,
          averages.activeProjects,
          averages.actions,
          "",
          averages.weeklyLogins,
          averages.weeklyActiveProjects,
          averages.weeklyActions,
          "",
          averages.dailyLogins,
          averages.dailyActiveProjects,
          averages.dailyActions
        ]

        // Adding new user metrics
        csv[csv.length] = []
        csv[csv.length] = [
          "", "", "", "", "", "", "",
          "Total Users",
          userSignupData.totalUsers, // total users
          "", "",
          "New Users Last 7 Days",
          userSignupData.newUsersLastWeek, // new users last 7 days
          "", "",
          "New Users Today",
          userSignupData.newUsersToday // new users today
        ]
        
  
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
