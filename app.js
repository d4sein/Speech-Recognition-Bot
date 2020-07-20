const fs = require('fs')
const Discord = require('discord.js')
const { prefix, token } = require('./config')

const dialogflow = require('dialogflow').v2beta1
const util = require('util')
const {struct} = require('pb-util')

const { Readable } = require('stream')

class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]));
  }
}

// Discord Client
const client = new Discord.Client()

// projectId: ID of the GCP project where Dialogflow agent is deployed
const projectId = 'newagent-vxvwah'
// sessionId: String representing a random number or hashed user identifier
const sessionId = '123456789'
// languageCode: Indicates the language Dialogflow agent should use to detect intents
const languageCode = 'en'

async function detectAudioIntent(
  projectId,
  sessionId,
  languageCode,
  filename,
  encoding,
  sampleRateHertz
) {
  // Instantiates a session client
  const sessionClient = new dialogflow.SessionsClient()

  // The path to identify the agent that owns the created intent.
  const sessionPath = sessionClient.sessionPath(
    projectId,
    sessionId
  )

  // Read the content of the audio file and send it as part of the request.
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
  };

  // Recognizes the speech in the audio and detects its intent.
  const [response] = await sessionClient.detectIntent(request)

  console.log('Detected intent:')
  const result = response.queryResult

  console.log(result)

  console.log(`  Query: ${result.queryText}`)
  console.log(`  Response: ${result.fulfillmentText}`)
  if (result.intent) {
    console.log(`  Intent: ${result.intent.displayName}`)
  } else {
    console.log('  No intent matched.')
  }
}


client.on('ready', () => {
  console.log(`Up and running.`)
})

client.on('message', async ctx => {
  if (!ctx.content.startsWith(prefix)) return

  let command = ctx.content.slice(prefix.length)

  switch (command) {
    case 'join':
      if (ctx.member.voice.channel) {
        await ctx.member.voice.channel.join()
          .then(connection => {
            connection.play(new Silence(), { type: 'opus' })

            const audioStream = connection.receiver.createStream(ctx.author, { mode: 'pcm' })
            const ffmpeg = require('fluent-ffmpeg')

            ffmpeg(audioStream)
              .inputFormat('s32le')
              .audioFrequency(44100)
              .audioChannels(1)
              .audioCodec('pcm_s16le')
              .format('s16le')
              .on('error', console.error)
              .pipe(fs.createWriteStream('user_audio.wav'))
          })
      }
      break

    case 'leave':
      try {
        await ctx.guild.voice.channel.leave()
      }
      catch {}
      break

    case 'listen':
      await detectAudioIntent(projectId, sessionId, languageCode, 'user_audio.wav', 'AUDIO_ENCODING_LINEAR_16', 44100)
      break

    default:
      break
  }
})

client.login(token)
