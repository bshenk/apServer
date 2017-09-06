const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const officegen = require('officegen')
const fs = require('fs')
const PORT = 3030

function readJSONFile (filename, callback) {
  fs.readFile(filename, function (err, data) {
    if (err) {
      callback(err)
      return
    }
    try {
      callback(null, JSON.parse(data))
    } catch (exception) {
      callback(exception)
    }
  })
}

app.use(cors())

app.get('/settings', (req, res) => {
  readJSONFile('./settings.json', (err, json) => {
    if (err) console.error(err)
    console.log(json)
    res.send(json)
  })
})

app.use(bodyParser.json())

app.post('/export', (req, res) => {
  const docx = officegen('docx')

  docx.on('finalize', () => {
    console.log('Document finalized.')
  })

  docx.on('error', err => {
    console.log(err)
  })

  req.body.bookmarks.forEach(bookmark => {
    const pObj = docx.createP()

    pObj.addText(bookmark.AttributeValueMap.Number, { font_size: 20 })
    pObj.addLineBreak()
    pObj.addText(bookmark.AttributeValueMap.Title, { font_size: 16 })

    pObj.addLineBreak()

    var urlString = bookmark.AttributeValueMap.UrlString
    if (urlString.indexOf('?') > -1) urlString = urlString.substring(0, urlString.indexOf('?'))
    pObj.addText('View Full Patent', { link: urlString })

    pObj.addLineBreak()
    pObj.addLineBreak()

    const classifications = ['CooperativeClassifications', 'EuropeanClassifications', 'USClassifications', 'InternationalClassifications']

    classifications.forEach(classification => {
      if (bookmark.AttributeValueMap[classification]) {
        pObj.addText(`${classification}: `, { bold: true })
        pObj.addText(`${bookmark.AttributeValueMap[classification].join()}`, { italic: true })

        pObj.addLineBreak()
      }
    })

    pObj.addLineBreak()

    pObj.addText(bookmark.AttributeValueMap.Abstract, { font_size: 12 })

    pObj.addLineBreak()

    pObj.addHorizontalLine()
  })

  docx.generate(res)
})

app.listen(PORT, () => {
  console.log(`AxonPatent FE server running at: ${PORT}`)
})
