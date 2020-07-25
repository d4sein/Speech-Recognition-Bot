const fs = require('fs')
const { Readable } = require('stream')

const Discord = require('discord.js')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

// ffmpeg.setFfmpegPath(path)
// ffmpeg.setFfprobePath(path)

const ytdl = require('ytdl-core')
const ytsr = require('ytsr')

const pico = require('hotword')
const wavdecoder = require('wav-decoder')

const { prefix, token } = require('./config')
const { detectAudioIntent } = require('./dialogflow-setup')


// Noiseless stream of audio to send when the bot joins a voice channel
class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]))
  }
}

// const piko = new pico ({
//   howdy: fs.readFileSync('bumblebee.ppn')
// }, 16000, (word) => {
//   console.log(word)
// })

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
            // ffmpeg(audioStream)
            let convertedAudio = ffmpeg(audioStream)
              .inputFormat('s32le')
              .audioFrequency(44100)
              .audioChannels(1)
              .audioCodec('pcm_s16le')
              .format('wav')
              .on('error', console.error)
              // .format('s16le')
              // .pipe(fs.createWriteStream('audio2.wav'))

            let inputAudio
            let bufs = []
            
            convertedAudio = convertedAudio.pipe()
            convertedAudio
              .on('data', (chunk) => {
                bufs.push(chunk)
              })
              .on('end', async () => {
                inputAudio = Buffer.concat(bufs)

                wavdecoder.decode(inputAudio)
                  .then((wav) => {
                    let piko = new pico ({
                        howdy: fs.readFileSync('bumblebee.ppn')
                    }, wav.sampleRate, async () => {
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
                            let search = result.queryText.split(' ').slice(1).join(' ')
                            let url = await ytsr(search, { limit: 1 })
                            url = url.items[0].link
          
                            connection.play(ytdl(url, {filter: 'audioonly'}))
                            ctx.channel.send(result.queryText)
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
            
                    piko.init()
                      .then(() => {
                        for (let i = 0; i < wav.channelData[0].length; i += 1024)
                        piko.feed(wav.channelData[0].slice(i, i + 1024))
                      })
                  })
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
