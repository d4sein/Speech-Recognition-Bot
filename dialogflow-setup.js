const dialogflow = require('dialogflow')


// Configuration
const projectId = 'newagent-vxvwah'
const sessionId = '123456789'
const languageCode = 'en'

async function detectAudioIntent(
  inputAudio,
  encoding,
  sampleRateHertz
) {
  const sessionClient = new dialogflow.SessionsClient()

  // The path to identify the agent that owns the created intent
  const sessionPath = sessionClient.sessionPath(
    projectId,
    sessionId
  )

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
