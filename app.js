const fs = require('fs')
const util = require('util')
const { Readable, Writable } = require('stream')

const Discord = require('discord.js')
const ffmpeg = require('fluent-ffmpeg')
const ytdl = require('ytdl-core')
const ytsr = require('ytsr')

const { prefix, token } = require('./config')
const { detectAudioIntent } = require('./dialogflow-setup')


// Noiseless stream of audio to send when the bot joins a voice channel
class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]))
  }
}

// function sleep(ms) {
//   return new Promise((resolve) => {
//     setTimeout(resolve, ms)
//   })
// }

const client = new Discord.Client()

client.on('ready', () => {
  console.log(`Up and running.`)
})

client.on('message', async ctx => {
  if (!ctx.content.startsWith(prefix)) return

  const command = ctx.content.slice(prefix.length)

  switch (command) {
    case 'join':
      if (ctx.member.voice.channel) {

        const connection = await ctx.member.voice.channel.join()
        connection.play(new Silence(), { type: 'opus' })

        connection.on('speaking', async (user, speaking) => {
          if (speaking.has('SPEAKING')) {
            const audioStream = connection.receiver.createStream(user, { mode: 'pcm' })

            // Transforms the audio stream into something Dialogflow understands
            let convertedAudio = ffmpeg(audioStream)
              .inputFormat('s32le')
              .audioFrequency(44100)
              .audioChannels(1)
              .audioCodec('pcm_s16le')
              .format('s16le')
              .on('error', console.error)
            
            let inputAudio
            let bufs = []
              
            convertedAudio = convertedAudio.pipe()
            convertedAudio
              .on('data', (chunk) => {
                bufs.push(chunk)
              })
              .on('end', async () => {
                inputAudio = Buffer.concat(bufs)

                try {
                  let result = await detectAudioIntent(
                    inputAudio,
                    'AUDIO_ENCODING_LINEAR_16',
                    44100
                  )
                  
                  // Debug
                  console.log(result)
                  
                  switch (result.action) {
                    case 'Play':
                      let url = await ytsr(result.queryText, { limit: 1 })
                      url = url.items[0].link
    
                      connection.play(ytdl(url, {filter: 'audioonly'}))
                      break
                    
                    case 'Stop':
                      break
                    
                    case 'Pause':
                      break
    
                    case 'Skip':
                      break
    
                    default:
                      break
                    }
                } catch (err) {
                  console.error(err)
                }
              })
          }
        })
      }
      break

    case 'leave':
      try {
        ctx.guild.voice.channel.leave()
      }
      catch {}
      break

    default:
      break
  }
})

client.login(token)
