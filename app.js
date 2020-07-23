const fs = require('fs')
const { Readable } = require('stream')

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


const client = new Discord.Client()

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}



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
        const queue = new Map()

        connection.play(new Silence(), { type: 'opus' })

        connection.on('speaking', async (user, speaking) => {
          if (speaking.has('SPEAKING')) {
            let audioStream = connection.receiver.createStream(user, { mode: 'pcm' })
            
            // Transforms the audio stream into something Dialogflow understands
            ffmpeg(audioStream)
              .inputFormat('s32le')
              .audioFrequency(44100)
              .audioChannels(1)
              .audioCodec('pcm_s16le')
              .format('s16le')
              .on('error', console.error)
              .pipe(fs.createWriteStream(`${user.id}.wav`))

            await sleep(1500)
            
            try {
              let result = await detectAudioIntent(
                `${user.id}.wav`,
                'AUDIO_ENCODING_LINEAR_16',
                44100
                )
                
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
            } catch {}
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
