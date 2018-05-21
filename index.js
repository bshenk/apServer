const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const officegen = require('uxal-officegen')
const https = require('https')
const fs = require('fs')
const PORT = 3030

const getMetricsCSV = require('./getMetricsCSV.js').getMetricsCSV

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

var whitelist = ['http://localhost', 'http://localhost:3000']
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

app.use(bodyParser.json({ limit: '50mb' }))
app.use(cors(corsOptions))

app.post('/metrics', (req, res) => {
  const { config, users } = req.body
  getMetricsCSV(config, users)
    .then(response => res.send(response))
    .catch(error => res.status(500).send(error))
})

app.get('/settings', (req, res) => {
  readJSONFile('./settings.json', (err, json) => {
    if (err) console.error(err)
    console.log(json)
    res.send(json)
  })
})

app.post('/export', (req, res) => {
  const docx = officegen({
    type: 'docx',
    pageMargins: { top: 500, right: 500, bottom: 500, left: 500 }
  })

  docx.on('finalize', () => {
    console.log('Document finalized.')
  })

  docx.on('error', err => {
    console.log(err)
  })

  const pObj = docx.createP()

  pObj.startBookmark('top')
  pObj.addText('PROJECT', { font_size: 12, bold: true })
  pObj.addLineBreak()
  pObj.addText(req.body.id, { font_size: 24 })
  pObj.addLineBreak()
  pObj.addHorizontalLine()
  pObj.addLineBreak()

  // Searches and Bookmark Links
  pObj.addText('SEARCHES', { font_size: 11, bold: true })
  pObj.addLineBreak()
  req.body.searches.forEach(search => {
    pObj.addText(search)
    pObj.addLineBreak()
  })

  pObj.addLineBreak()

  pObj.addText('INDEX OF BOOKMARKED PATENTS (Click to Jump to Bookmark)', { font_size: 11, bold: true })
  pObj.addLineBreak()
  req.body.bookmarks.forEach(bookmark => {
    pObj.addText(bookmark.AttributeValueMap.Number, { hyperlink: bookmark._id, color: '#5D9BE7' })
    pObj.addLineBreak()
  })

  pObj.addLineBreak()
  pObj.addHorizontalLine()
  pObj.addLineBreak()

  pObj.addText('DETAILS OF BOOKMARKED PATENTS', { font_size: 11, bold: true })
  pObj.addLineBreak()

  pObj.endBookmark()

  req.body.bookmarks.forEach(bookmark => {
    var pObj = docx.createP()

    pObj.startBookmark(bookmark._id)
    pObj.addText('Back to Top', { hyperlink: 'top', color: '#5D9BE7' })
    pObj.addLineBreak()
    pObj.addText(bookmark.AttributeValueMap.Number, { font_size: 20 })
    pObj.addLineBreak()
    pObj.addText(bookmark.AttributeValueMap.Title, { font_size: 16 })

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

    pObj.addText('IMAGES', { font_size: 10, bold: true })
    pObj.addLineBreak()

    var images = bookmark.AttributeValueMap.ImageUrls

    if (images.length > 0) {
      images.forEach((url, i) => {
	      url = `http://patentimages.convergentai.net${url}`
        pObj.addText(`${i + 1}${i + 1 === images.length ? '' : ','} `, { link: url, color: '#5D9BE7' })
      })
    } else {
      pObj.addText('No images for this patent.')
    }

    pObj.addLineBreak()
    pObj.addLineBreak()

    pObj.addText('ABSTRACT', { font_size: 10, bold: true })
    pObj.addLineBreak()
    pObj.addText(bookmark.AttributeValueMap.Abstract, { font_size: 12 })

    pObj.addLineBreak()
    pObj.addLineBreak()

    pObj.addText('CLAIMS', { font_size: 10, bold: true })
    pObj.addLineBreak()
    bookmark.AttributeValueMap.Claims.forEach(claim => {
      pObj.addText(claim)
      pObj.addLineBreak()
      pObj.addLineBreak()
    })

    pObj.endBookmark()

    docx.putPageBreak()
  })

  docx.generate(res)

  console.log(res.getHeaders())
})

// const options = {
//   cert: fs.readFileSync('/etc/letsencrypt/live/patent.convergentai.net/fullchain.pem'),
//   key: fs.readFileSync('/etc/letsencrypt/live/patent.convergentai.net/privkey.pem')
// }

// https.createServer(options, app).listen(PORT)

app.listen(PORT, () => {
  console.log(`AxonPatent FE server running at: ${PORT}`)
})
