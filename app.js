const { Readable } = require('stream')

const Discord = require('discord.js')
const ytdl = require('ytdl-core')

const { prefix, token } = require('./config')
const { processAudio } = require('./audio-processing-setup')
const { handleVoiceCommands } = require('./voice-commands')


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

  const command = ctx.content.slice(prefix.length).split()

  switch (command[0]) {
    case 'join':
      if (ctx.member.voice.channel) {
        const connection = await ctx.member.voice.channel.join()

        connection.play(new Silence(), { type: 'opus' })
        ctx.channel.send('I\'m listening.. My hotword is **bumblebee**.')

        connection.on('speaking', async (user, speaking) => {
          if (speaking.has('SPEAKING')) {
            let audioStream = connection.receiver.createStream(user, { mode: 'pcm' })
            let result = await processAudio(audioStream)

            if (result) handleVoiceCommands(result, connection, ctx)
          }
        })
      }
      break

    case 'play':
      if (!args) return
      if (!ytdl.validateURL(args[0])) return
      break

    case 'leave':
      try { ctx.guild.voice.channel.leave() } catch {}
      break

    default:
      break
  }
})

client.login(token)
