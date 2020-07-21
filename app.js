const fs = require('fs')
const { Readable } = require('stream')

const Discord = require('discord.js')
const ffmpeg = require('fluent-ffmpeg')

const { prefix, token } = require('./config')
const { detectAudioIntent } = require('./dialogflow-setup')


// Noiseless stream of audio to send when the bot joins a voice channel
class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]))
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

        await ctx.member.voice.channel.join()
          .then(connection => {
            connection.play(new Silence(), { type: 'opus' })

            let audioStream = connection.receiver.createStream(ctx.author, { mode: 'pcm' })
            
            // Transforms the audio stream into something Dialogflow understands
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
      let result = await detectAudioIntent(
        'user_audio.wav',
        'AUDIO_ENCODING_LINEAR_16',
        44100
      )

      await ctx.channel.send(result.queryText)
      break

    default:
      break
  }
})

client.login(token)
