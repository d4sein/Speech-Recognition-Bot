const fs = require('fs')
const util = require('util')

const dialogflow = require('dialogflow')

// Configuration
const projectId = 'newagent-vxvwah'
const sessionId = '123456789'
const languageCode = 'en'

async function detectAudioIntent(
  filename,
  encoding,
  sampleRateHertz
) {
  const sessionClient = new dialogflow.SessionsClient()

  // The path to identify the agent that owns the created intent
  const sessionPath = sessionClient.sessionPath(
    projectId,
    sessionId
  )

  // Reads the content of the audio file and send it as part of the request
  const readFile = util.promisify(fs.readFile)
  const inputAudio = await readFile(filename)

  const request = {
    session: sessionPath,
    queryInput: {
      audioConfig: {
        audioEncoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
      },
    },
    inputAudio: inputAudio,
  }

  // Recognizes the speech in the audio and detects its intent
  const [response] = await sessionClient.detectIntent(request)
  const result = response.queryResult

  return result
}

module.exports = { detectAudioIntent }
