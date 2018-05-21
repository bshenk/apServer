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
    
    var csv = []
    csv.push(["", "PatentID User Metrics" , "", "", "", "Today"])
    csv.push([formatDate(midnight)    , "", "", "", "# of New Users Today", "# of Active Projects Today"])
    csv.push([])
    csv.push(["User Name", "Email", "Promo", "Sign Up Date", "# of Days Since Sign Up", "# of Projects", "# of Projects Started in Past Week", "# of Actions", "# of Actions in Past Week", "# of Logins", "# of Days Since Last Login"])  
  
    MongoClient.connect(url, { useNewUrlParser: true }, async function(err, db) {
      assert.equal(null, err);
  
      var mainDB = db.db(config.db)
      var activeToday    = false;
      var activePastWeek = false;
      
      var todayData = {
        newUsersToday: 0,
        newProjectsToday: 0,
        activeProjectsToday: 0
      }
  
      // Fillilng in initial user metrics with data from the frontend
      for(var user in users) {
        if(users.hasOwnProperty(user)) {
          if(new Date(users[user].createdAt).getTime() >= midnight) { todayData.newUsersToday++ }
  
          projectsCount[users[user]._id]    = 0
          projectsPastWeek[users[user]._id] = 0
          actionsCount[users[user]._id]     = 0
          actionsPastWeek[users[user]._id]  = 0
  
          csv.push([users[user]._id, users[user].email, users[user].promo, formatDate(new Date(users[user].createdAt)), 
            users[user].daysSinceSignUp, 0, 0, 0, 0, users[user].totalLogins, users[user].daysSinceLastLogin])
        }
      }
  
      var projects = await mainDB.collection(config.collection).find().toArray(function(err, result){
        result.forEach(document => {
          if (err) reject(err)
  
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
            if(happenedPastWeek) { actionsPastWeek[document.userHash]++ }
  
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
  
          if(activeToday){
            todayData.activeProjectsToday++;
            activeToday = false;
          }
  
          // Filling in missing user data here
          for(var outer = 0; outer < csv.length; outer++){
            if(csv[outer][0] === document.userHash){
              csv[outer][5] = projectsCount[document.userHash]
              csv[outer][6] = projectsPastWeek[document.userHash]
              csv[outer][7] = actionsCount[document.userHash]
              csv[outer][8] = actionsPastWeek[document.userHash]
            }
          }
        })
      
        // Adding daily metrics
        csv[2] = ["", "", "", "", todayData.newUsersToday, todayData.activeProjectsToday]
  
        // Write out csv object to a CSV file here
        // fs.writeFile("./test.csv", 
        //   csv.map(function(row) { return (row + '\r') }), 
        //   (err) => {
        //     if (err) throw err;
        //     console.log("Wrote out to file!")
        // })
        resolve(csv)
      })
  
      // close db connection now that we're done with the query
      db.close()
    })
  })
}

module.exports = {
  getMetricsCSV
}