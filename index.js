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

  let { number, abstract, dates, title, images, classifications, description, claims, assignees, inventors } = config.documents

  if (config.bookmarks) {
    // set bookmarks
    sheet.data.push(['BOOKMARKS'])
    sheet.data.push([
      'Number', 
      'Title', 
      'Abstract',
      'Description',
      'Claims',
      'US Class',
      'EU Class', 
      'Int Class', 
      'Field Class', 
      'Coop Class', 
      'Images', 
      'Priority Date', 
      'Filing Date', 
      'Publication Date',
      'Assignees',
      'Inventors'
    ])

    data.bookmarkOrder.forEach((bookmarkID, i) => {
      let bookmark = data.bookmarks.find(ele => ele._id === bookmarkID)
      if (!bookmark) return
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
        FilingDate,
        Description,
        Claims,
        Assignee,
        Inventor
      } = bookmark.AttributeValueMap

      sheet.data.push([
        number ? Number : '',
        title ? Title : '',
        abstract ? Abstract : '',
        description ? Description.join(', ').substring(0, 30000) : '',
        claims ? Claims.join(', ').substring(0, 30000) : '',
        classifications ? USClassifications.join(', ').substring(0, 30000) : '',
        classifications ? EuropeanClassifications.join(', ').substring(0, 30000) : '',
        classifications ? InternationalClassifications.join(', ').substring(0, 30000) : '',
        classifications ? FieldClassifications.join(', ').substring(0, 30000) : '',
        classifications ? CooperativeClassifications.join(', ').substring(0, 30000) : '',
        images ? ImageUrls.join(', ') : '',
        dates ? PriorityDate : '',
        dates ? FilingDate : '',
        dates ? PublicationDate : '',
        assignees && Assignee ? Assignee.join(', ') : '',
        inventors && Inventor ? Inventor.join(', ') : ''
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
      'Description',
      'Claims',
      'US Class',
      'EU Class', 
      'Int Class', 
      'Field Class', 
      'Coop Class', 
      'Images', 
      'Priority Date', 
      'Filing Date', 
      'Publication Date',
      'Assignees',
      'Inventors'
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
        FilingDate,
        Description,
        Claims,
        Assignee,
        Inventor
      } = reference.AttributeValueMap

      sheet.data.push([
        number ? Number : '',
        title ? Title : '',
        abstract ? Abstract : '',
        description ? Description.join(', ').substring(0, 30000) : '',
        claims ? Claims.join(', ').substring(0, 30000) : '',
        classifications ? USClassifications.join(', ').substring(0, 30000) : '',
        classifications ? EuropeanClassifications.join(', ').substring(0, 30000) : '',
        classifications ? InternationalClassifications.join(', ').substring(0, 30000) : '',
        classifications ? FieldClassifications.join(', ').substring(0, 30000) : '',
        classifications ? CooperativeClassifications.join(', ').substring(0, 30000) : '',
        images ? ImageUrls.join(', ').substring(0, 30000) : '',
        dates ? PriorityDate : '',
        dates ? FilingDate : '',
        dates ? PublicationDate : '',
        assignees && Assignee ? Assignee.join(', ') : '',
        inventors && Inventor ? Inventor.join(', ') : ''
      ])
    })

    sheet.data.push([''])
  }

  // set searches
  if (config.inputs) {
    sheet.data.push(['SEARCHES'])
    sheet.data.push(data.searches)
    sheet.data.push([''])
  }

  // set uploads 
  if (config.inputs) {
    sheet.data.push(['UPLOADS'])
    sheet.data.push(data.uploads)
    sheet.data.push([''])
  }

  // set terms
  if (config.outputs) {
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
  pObj.addText('PROJECT', { font_size: 10, bold: true })
  pObj.addLineBreak()
  pObj.addText(projectName, { font_size: 24 })
  pObj.addLineBreak()
  pObj.addLineBreak()

  if (config.inputs) {
    pObj.addText('Interest Model Summary', { font_size: 18 })
    pObj.addLineBreak()

    pObj.addText('SEARCHES', { font_size: 11, bold: true })
    pObj.addLineBreak()
    data.searches.forEach(search => {
      pObj.addText(search)
      pObj.addLineBreak()
    })

    pObj.addLineBreak()
  
    pObj.addText('UPLOADS', { font_size: 11, bold: true })
    pObj.addLineBreak()
    data.uploads.forEach(upload => {
      pObj.addText(upload)
      pObj.addLineBreak()
    })

    pObj.addLineBreak()

    pObj.addText('INDEX OF BOOKMARKED PATENTS (Click to Jump to Bookmark)', { font_size: 11, bold: true })
    pObj.addLineBreak()
    data.bookmarkOrder.forEach(id => {
      let bookmark = data.bookmarks.find(ele => ele._id === id)
      if (!bookmark) return
      pObj.addText(`${bookmark.AttributeValueMap.Number}: ${bookmark.AttributeValueMap.Title}`, { hyperlink: `${bookmark._id}-Bookmarked`, color: '#5D9BE7' })
      pObj.addLineBreak()
    })

    pObj.addLineBreak()

    pObj.addText('INDEX OF REFERENCED PATENTS (Click to Jump to Reference)', { font_size: 11, bold: true })
    pObj.addLineBreak()
    data.references.forEach(bookmark => {
      pObj.addText(`${bookmark.AttributeValueMap.Number}: ${bookmark.AttributeValueMap.Title}`, { hyperlink: `${bookmark._id}-Referenced`, color: '#5D9BE7' })
      pObj.addLineBreak()
    })

    if (!config.outputs) docx.putPageBreak()
  }

  if (config.outputs) {
    pObj.addLineBreak() 
    pObj.addText('TERM WEIGHTS', { font_size: 11, bold: true })
    pObj.addLineBreak()
    Object.keys(data.terms).forEach(key => {
      pObj.addText(`${key}: ${data.terms[key]}, `)
    })

    docx.putPageBreak()
  }

  pObj.endBookmark()

  if (config.bookmarks) {
    addDocuments(docx, req.body, 'Bookmarked')
  }

  if (config.references) {
    addDocuments(docx, req.body, 'Referenced')
  }

  return docx
}

function addDocuments (mainDoc, reqBody, type) {
  let { data, config, projectName } = reqBody
  let pObj = mainDoc.createP()

  pObj.addText(`${type} Documents`, { font_size: 22 })
  pObj.addLineBreak()

  let docs = type === 'Bookmarked' ? data.bookmarkOrder : data.references

  docs.forEach(ele => {
    let doc = ele
    if (type === 'Bookmarked') doc = data.bookmarks.find(bookmark => bookmark._id === ele)
    if (!doc) return

    pObj.startBookmark(`${doc._id}-${type}`)
    pObj.addText('Back to Top', { hyperlink: 'top', color: '#5D9BE7' })

    if (config.documents.number) {
      pObj.addLineBreak()
      pObj.addText(doc.AttributeValueMap.Number, { font_size: 18 })
    }

    if (config.documents.title) {
      pObj.addLineBreak()
      pObj.addText(doc.AttributeValueMap.Title, { font_size: 16 })
    }

    if (config.documents.dates) {
      pObj.addLineBreak()

      pObj.addText('Priority: ', { bold: true})
      pObj.addText(doc.AttributeValueMap.PriorityDate)
      pObj.addLineBreak()

      pObj.addText('Filed: ', { bold: true })
      pObj.addText(doc.AttributeValueMap.FilingDate)
      pObj.addLineBreak()

      pObj.addText('Published: ', { bold: true })
      pObj.addText(doc.AttributeValueMap.PublicationDate)
    }

    pObj.addLineBreak()
    pObj.addLineBreak()

    const classifications = ['CooperativeClassifications', 'EuropeanClassifications', 'USClassifications', 'InternationalClassifications']

    if (config.documents.classifications) {
      classifications.forEach(classification => {
        if (doc.AttributeValueMap[classification]) {
          pObj.addText(`${classification}: `, { bold: true })
          if (doc.AttributeValueMap[classification].length > 0) {
            pObj.addText(`${doc.AttributeValueMap[classification].join()}`, { italic: true })
          } else {
            pObj.addText('n/a', { italic: true })
          }

          pObj.addLineBreak()
        }
      })

      pObj.addLineBreak()
    }

    if (config.documents.images) {
      pObj.addText('IMAGES', { font_size: 10, bold: true })
      pObj.addLineBreak()

      var images = doc.AttributeValueMap.ImageUrls

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

    if (config.documents.inventors) {
      pObj.addText('INVENTORS', { font_size: 10, bold: true })
      pObj.addLineBreak()
      if (doc.AttributeValueMap.Inventor && doc.AttributeValueMap.Inventor.length > 0) {
        pObj.addText(doc.AttributeValueMap.Inventor.join(', '))
      } else {
        pObj.addText('n/a')
      }
      pObj.addLineBreak()
      pObj.addLineBreak()
    }

    if (config.documents.assignees) {
      pObj.addText('ASSIGNEES', { font_size: 10, bold: true })
      pObj.addLineBreak()
      if (doc.AttributeValueMap.Assignee && doc.AttributeValueMap.Assignee.length > 0) {
        pObj.addText(doc.AttributeValueMap.Assignee.join(', '))
      } else {
        pObj.addText('n/a')
      }
      pObj.addLineBreak()
      pObj.addLineBreak()
    }

    if (config.documents.abstract) {
      pObj.addText('ABSTRACT', { font_size: 10, bold: true })
      pObj.addLineBreak()
      pObj.addText(doc.AttributeValueMap.Abstract, { font_size: 12 })

      pObj.addLineBreak()
      pObj.addLineBreak()
    }

    if (config.documents.description) {
      pObj.addText('DESCRIPTION', { font_size: 10, bold: true })
      pObj.addLineBreak()
      
      doc.AttributeValueMap.Description.forEach(desc => {
        pObj.addText(desc)
        pObj.addLineBreak()
      })
    }

    if (config.documents.claims) {
      pObj.addLineBreak()
      
      pObj.addText('CLAIMS', { font_size: 10, bold: true })
      pObj.addLineBreak()
      
      doc.AttributeValueMap.Claims.forEach(claim => {
        pObj.addText(claim)
        pObj.addLineBreak()
      })
    }

    pObj.addLineBreak()
    pObj.addLineBreak()

    pObj.endBookmark()

    // mainDoc.putPageBreak()
  })
}

// const options = {
//   cert: fs.readFileSync('/etc/letsencrypt/live/patent.convergentai.net/fullchain.pem'),
//   key: fs.readFileSync('/etc/letsencrypt/live/patent.convergentai.net/privkey.pem')
// }

// https.createServer(options, app).listen(PORT)

app.listen(PORT, () => {
  console.log(`AxonPatent FE server running at: ${PORT}`)
})
