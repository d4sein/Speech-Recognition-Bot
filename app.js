const { Readable } = require('stream')

const Discord = require('discord.js')

const ytdl = require('ytdl-core')
const ytsr = require('ytsr')

const { prefix, token } = require('./config')
const { processAudio } = require('./audio-processing-setup')


// Noiseless stream of audio to send when the bot joins a voice channel
class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]))
  }
}

async function handleVoiceCommands(command, connection, ctx) {
  console.log(command.queryText + ' -> ' + command.action)
  async function playQueue() {
    let server = servers[ctx.guild.id]
    
    server.dispatcher = connection.play(ytdl(server.queue[0], { filter: 'audioonly' }))

    server.dispatcher.on('finish', function () {
      server.queue.shift()

      if (server.queue[0]) {
        setTimeout(playQueue, 3000)
      }
    })
  }

  async function addToQueue() {
    if (!servers[ctx.guild.id]) servers[ctx.guild.id] = { queue: [] }
    let server = servers[ctx.guild.id]
    
    let search = command.queryText.split(' ').slice(2).join(' ')
    let url = await ytsr(search, { limit: 1 })
    
    server.queue.push(url.items[0].link)
  }

  let server = servers[ctx.guild.id]
  if (server) console.log(server.queue)

  switch (command.action) {
    case 'Play':
      await addToQueue()
      await playQueue()
      break
    
    case 'Add':
      await addToQueue()
      break

    case 'Stop':
      server.queue = []
      server.dispatcher.destroy()
      break
    
    case 'Pause':
      if (!server.dispatcher.paused) server.dispatcher.pause()
      break
    
    case 'Resume':
      // Not working yet (for some reason)
      if (server.dispatcher.paused) server.dispatcher.resume()

    case 'Skip':
      if (server.dispatcher) server.dispatcher.destroy()
      break

    default:
      break
  }
}

const client = new Discord.Client()

// To store queues
servers = {}

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
            let audioStream = connection.receiver.createStream(user, { mode: 'pcm' })
            let result = await processAudio(audioStream)

            if (result) {
              handleVoiceCommands(result, connection, ctx)
            }
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
