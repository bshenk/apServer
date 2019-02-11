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
app.use(cors())

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
  if (req.body.config.mode === 'docx') {
    let docx = generateDocx(req)
    docx.generate(res)
  } else if (req.body.config.mode === 'xlsx') {
    let xlsx = generateXlsx(req)
    xlsx.generate(res)
  }
})

function generateXlsx (req) {
  let { data, config, projectName } = req.body
  const xlsx = officegen({
    type: 'xlsx'
  })

  xlsx.on('finalize', () => {
    console.log('Document finalized.')
  })

  xlsx.on('error', err => {
    console.log(err)
  })

  let sheet = xlsx.makeNewSheet()
  sheet.name = `${projectName}`

  sheet.data.push(['PROJECT NAME'])
  sheet.data.push([projectName])
  sheet.data.push([''])

  let { number, abstract, dates, title, images, classifications } = config.documents

  if (config.bookmarks) {
    // set bookmarks
    sheet.data.push(['BOOKMARKS'])
    sheet.data.push([
      'Number', 
      'Title', 
      'Abstract', 
      'US Class',
      'EU Class', 
      'Int Class', 
      'Field Class', 
      'Coop Class', 
      'Images', 
      'Priority Date', 
      'Filing Date', 
      'Publication Date'
    ])

    data.bookmarks.forEach((bookmark, i) => {
      let { 
        id, 
        Number, 
        Title, 
        Abstract, 
        ImageUrls, 
        USClassifications, 
        EuropeanClassifications, 
        InternationalClassifications, 
        CooperativeClassifications, 
        FieldClassifications,
        PriorityDate,
        PublicationDate,
        FilingDate
      } = bookmark.AttributeValueMap

      sheet.data.push([
        number ? Number : '',
        title ? Title : '',
        abstract ? Abstract : '',
        classifications ? USClassifications.join(', ') : '',
        classifications ? EuropeanClassifications.join(', ') : '',
        classifications ? InternationalClassifications.join(', ') : '',
        classifications ? FieldClassifications.join(', ') : '',
        classifications ? CooperativeClassifications.join(', ') : '',
        images ? ImageUrls : '',
        dates ? PriorityDate : '',
        dates ? FilingDate : '',
        dates ? PublicationDate : ''
      ])
    })

    sheet.data.push([''])
  }

  // set references
  if (config.references) {
    // set bookmarks
    sheet.data.push(['REFERENCES'])
    sheet.data.push([
      'Number', 
      'Title', 
      'Abstract', 
      'US Class',
      'EU Class', 
      'Int Class', 
      'Field Class', 
      'Coop Class', 
      'Images', 
      'Priority Date', 
      'Filing Date', 
      'Publication Date'
    ])

    data.references.forEach((reference, i) => {
      let { 
        id, 
        Number, 
        Title, 
        Abstract, 
        ImageUrls, 
        USClassifications, 
        EuropeanClassifications, 
        InternationalClassifications, 
        CooperativeClassifications, 
        FieldClassifications,
        PriorityDate,
        PublicationDate,
        FilingDate
      } = reference.AttributeValueMap

      sheet.data.push([
        number ? Number : '',
        title ? Title : '',
        abstract ? Abstract : '',
        classifications ? USClassifications.join(', ') : '',
        classifications ? EuropeanClassifications.join(', ') : '',
        classifications ? InternationalClassifications.join(', ') : '',
        classifications ? FieldClassifications.join(', ') : '',
        classifications ? CooperativeClassifications.join(', ') : '',
        images ? ImageUrls : '',
        dates ? PriorityDate : '',
        dates ? FilingDate : '',
        dates ? PublicationDate : ''
      ])
    })

    sheet.data.push([''])
  }

  // set searches
  if (config.searches) {
    sheet.data.push(['SEARCHES'])
    sheet.data.push(data.searches)
    sheet.data.push([''])
  }

  // set uploads 
  if (config.uploads) {
    sheet.data.push(['UPLOADS'])
    sheet.data.push(data.uploads)
    sheet.data.push([''])
  }

  // set terms
  if (config.terms) {
    sheet.data.push(['TERMS'])
    sheet.data.push(Object.keys(data.terms).map(key => `${key}: ${data.terms[key]}`))
  }

  return xlsx
}

function generateDocx (req) {
  let { data, config, projectName } = req.body
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
  pObj.addText(projectName, { font_size: 24 })
  pObj.addLineBreak()

  pObj.addText('Go to Interest Model', { font_size: 16, hyperlink: 'interest-model', color: '#5D9BE7' })
  pObj.addLineBreak()
  pObj.addLineBreak()


  if (config.bookmarks) {
    pObj.addText('INDEX OF BOOKMARKED PATENTS (Click to Jump to Bookmark)', { font_size: 11, bold: true })
    pObj.addLineBreak()
    data.bookmarks.forEach(bookmark => {
      pObj.addText(`${bookmark.AttributeValueMap.Number}: ${bookmark.AttributeValueMap.Title}`, { hyperlink: bookmark._id, color: '#5D9BE7' })
      pObj.addLineBreak()
    })

    pObj.addLineBreak()
  }

  if (config.references) {
    pObj.addText('INDEX OF REFERENCED PATENTS (Click to Jump to Reference)', { font_size: 11, bold: true })
    pObj.addLineBreak()
    data.references.forEach(bookmark => {
      pObj.addText(`${bookmark.AttributeValueMap.Number}: ${bookmark.AttributeValueMap.Title}`, { hyperlink: `${bookmark._id}-ref`, color: '#5D9BE7' })
      pObj.addLineBreak()
    })
  }

  pObj.endBookmark()
  docx.putPageBreak()

  if (config.bookmarks) {
    data.bookmarks.forEach(bookmark => {
      var pObj = docx.createP()

      pObj.startBookmark(bookmark._id)
      pObj.addText('Back to Top', { hyperlink: 'top', color: '#5D9BE7' })

      if (config.documents.number) {
        pObj.addLineBreak()
        pObj.addText(bookmark.AttributeValueMap.Number, { font_size: 20 })
      }

      if (config.documents.title) {
        pObj.addLineBreak()
        pObj.addText(bookmark.AttributeValueMap.Title, { font_size: 16 })
      }

      if (config.documents.dates) {
        pObj.addLineBreak()

        pObj.addText('Priority: ', { bold: true})
        pObj.addText(bookmark.AttributeValueMap.PriorityDate)
        pObj.addLineBreak()

        pObj.addText('Filed: ', { bold: true })
        pObj.addText(bookmark.AttributeValueMap.FilingDate)
        pObj.addLineBreak()

        pObj.addText('Published: ', { bold: true })
        pObj.addText(bookmark.AttributeValueMap.PublicationDate)
      }

      pObj.addLineBreak()
      pObj.addLineBreak()

      const classifications = ['CooperativeClassifications', 'EuropeanClassifications', 'USClassifications', 'InternationalClassifications']

      if (config.documents.classifications) {
        classifications.forEach(classification => {
          if (bookmark.AttributeValueMap[classification]) {
            pObj.addText(`${classification}: `, { bold: true })
            pObj.addText(`${bookmark.AttributeValueMap[classification].join()}`, { italic: true })
  
            pObj.addLineBreak()
          }
        })
  
        pObj.addLineBreak()
      }

      if (config.documents.images) {
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
      }

      if (config.documents.abstract) {
        pObj.addText('ABSTRACT', { font_size: 10, bold: true })
        pObj.addLineBreak()
        pObj.addText(bookmark.AttributeValueMap.Abstract, { font_size: 12 })
  
        pObj.addLineBreak()
        pObj.addLineBreak()
      }

      // if (config.documents.claims) {
      //   console.log(bookmark.AttributeValueMap)
      //   return
      //   pObj.addText('CLAIMS', { font_size: 10, bold: true })
      //   pObj.addLineBreak()
      //   bookmark.AttributeValueMap.Claims.forEach(claim => {
      //     pObj.addText(claim)
      //     pObj.addLineBreak()
      //     pObj.addLineBreak()
      //   })
      // }

      pObj.endBookmark()

      docx.putPageBreak()
    })
  }

  if (config.references) {
    data.references.forEach(bookmark => {
      var pObj = docx.createP()

      pObj.startBookmark(`${bookmark._id}-ref`)
      pObj.addText('Back to Top', { hyperlink: 'top', color: '#5D9BE7' })

      if (config.documents.number) {
        pObj.addLineBreak()
        pObj.addText(bookmark.AttributeValueMap.Number, { font_size: 20 })
      }

      if (config.documents.title) {
        pObj.addLineBreak()
        pObj.addText(bookmark.AttributeValueMap.Title, { font_size: 16 })
      }

      if (config.documents.dates) {
        pObj.addLineBreak()

        pObj.addText('Priority: ', { bold: true})
        pObj.addText(bookmark.AttributeValueMap.PriorityDate)
        pObj.addLineBreak()

        pObj.addText('Filed: ', { bold: true })
        pObj.addText(bookmark.AttributeValueMap.FilingDate)
        pObj.addLineBreak()

        pObj.addText('Published: ', { bold: true })
        pObj.addText(bookmark.AttributeValueMap.PublicationDate)
      }
      
      pObj.addLineBreak()
      pObj.addLineBreak()

      const classifications = ['CooperativeClassifications', 'EuropeanClassifications', 'USClassifications', 'InternationalClassifications']

      if (config.documents.classifications) {
        classifications.forEach(classification => {
          if (bookmark.AttributeValueMap[classification]) {
            pObj.addText(`${classification}: `, { bold: true })
            pObj.addText(`${bookmark.AttributeValueMap[classification].join()}`, { italic: true })
  
            pObj.addLineBreak()
          }
        })
  
        pObj.addLineBreak()
      }

      if (config.documents.images) {
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
      }

      if (config.documents.abstract) {
        pObj.addText('ABSTRACT', { font_size: 10, bold: true })
        pObj.addLineBreak()
        pObj.addText(bookmark.AttributeValueMap.Abstract, { font_size: 12 })
  
        pObj.addLineBreak()
        pObj.addLineBreak()
      }

      // if (config.documents.claims) {
      //   console.log(bookmark.AttributeValueMap)
      //   return
      //   pObj.addText('CLAIMS', { font_size: 10, bold: true })
      //   pObj.addLineBreak()
      //   bookmark.AttributeValueMap.Claims.forEach(claim => {
      //     pObj.addText(claim)
      //     pObj.addLineBreak()
      //     pObj.addLineBreak()
      //   })
      // }

      pObj.endBookmark()

      docx.putPageBreak()
    })
  }

  let endObj = docx.createP()

  endObj.startBookmark('interest-model')

  endObj.addText('Interest Model', { font_size: 16, bold: true })
  endObj.addLineBreak()
  endObj.addText('Back to Top', { hyperlink: 'top', color: '#5D9BE7' })
  endObj.addLineBreak()
  endObj.addLineBreak()

  if (config.searches) {
    // Searches and Bookmark Links
    endObj.addText('SEARCHES', { font_size: 11, bold: true })
    endObj.addLineBreak()
    data.searches.forEach(search => {
      endObj.addText(search)
      endObj.addLineBreak()
    })

    endObj.addLineBreak()
  }

  if (config.uploads) {
    // Searches and Bookmark Links
    endObj.addText('UPLOADS', { font_size: 11, bold: true })
    endObj.addLineBreak()
    data.uploads.forEach(upload => {
      endObj.addText(upload)
      endObj.addLineBreak()
    })

    endObj.addLineBreak()
  }

  if (config.terms) {
    endObj.addText('TERM WEIGHTS', { font_size: 11, bold: true })
    endObj.addLineBreak()
    Object.keys(data.terms).forEach(key => {
      endObj.addText(`${key}: ${data.terms[key]}, `)
    })
  }

  endObj.endBookmark()

  return docx
}

// const options = {
//   cert: fs.readFileSync('/etc/letsencrypt/live/patent.convergentai.net/fullchain.pem'),
//   key: fs.readFileSync('/etc/letsencrypt/live/patent.convergentai.net/privkey.pem')
// }

// https.createServer(options, app).listen(PORT)

app.listen(PORT, () => {
  console.log(`AxonPatent FE server running at: ${PORT}`)
})
