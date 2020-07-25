const fs = require('fs')
const { Readable } = require('stream')

const Discord = require('discord.js')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const ytdl = require('ytdl-core')
const ytsr = require('ytsr')

const pico = require('hotword')
const hotword = fs.readFileSync('bumblebee.ppn')
const wavdecoder = require('wav-decoder')

const { prefix, token } = require('./config')
const { detectAudioIntent } = require('./dialogflow-setup')


// Noiseless stream of audio to send when the bot joins a voice channel
class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]))
  }
}

async function handleVoiceCommands(command, connection, ctx) {
  switch (command.action) {
    case 'Play':
      let search = command.queryText.split(' ').slice(2).join(' ')
      let url = await ytsr(search, { limit: 1 })
      url = url.items[0].link

      connection.play(ytdl(url, {filter: 'audioonly'}))
      ctx.channel.send('Play ' + search)
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
}

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
              .format('wav')
              .pipe()

            let inputAudio
            let bufs = []
            
            convertedAudio
              .on('data', (chunk) => {
                bufs.push(chunk)
              })
              .on('end', async () => {
                inputAudio = Buffer.concat(bufs)

                wavdecoder.decode(inputAudio)
                .then((wav) => {
                  let piko = new pico ({
                    bumblebee: hotword
                  }, wav.sampleRate, async () => {
                    let result

                    try {
                      result = await detectAudioIntent(
                        inputAudio,
                        'AUDIO_ENCODING_LINEAR_16',
                        44100
                      )
                    } catch (err) {
                      console.error(err)
                      return
                    }

                    handleVoiceCommands(result, connection, ctx)
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
      try { ctx.guild.voice.channel.leave() } catch {}
      break

    default:
      break
  }
})

client.login(token)
