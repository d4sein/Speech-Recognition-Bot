const { Readable } = require('stream')

const Discord = require('discord.js')

const ytdl = require('ytdl-core')
const ytsr = require('ytsr')
ytsr.do_warn_deprecate = false

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
    
    if (!server.queue.length) return
    server.dispatcher = connection.play(ytdl(server.queue[0], { filter: 'audioonly' }))

    server.dispatcher.on('finish', function () {
      server.queue.shift()

      if (server.queue[0]) {
        setTimeout(playQueue, 2000)
      }
    })
  }

  async function addToQueue() {
    if (!servers[ctx.guild.id]) servers[ctx.guild.id] = { queue: [] }
    let server = servers[ctx.guild.id]

    if (server.search) {
      const deny = ['do not', 'don\'t']
      const pairs = [
        ['first', 'one','1'],
        ['second', 'two','2'],
        ['third', 'three', '3'],
        ['fourth', 'four', '4'],
        ['fifth', 'five', '5']
      ]

      const index = pairs.findIndex(arr => arr.some(s => command.queryText.includes(s)))

      if (index >= 0) {
        server.queue.push(server.search[index].link)
        ctx.channel.send('Queueing..')
        delete server.search
      } else if (deny.some(s => command.queryText.includes(s))) {
        ctx.channel.send('Canceling search..')
        delete server.search
      }

      return
    }
    
    let search = command.queryText.split(' ').slice(2).join(' ')
    let url = await ytsr(search, { limit: 1 })
    
    server.queue.push(url.items[0].link)
  }

  async function makeSearch() {
    if (!servers[ctx.guild.id]) servers[ctx.guild.id] = { queue: [] }
    let server = servers[ctx.guild.id]

    let search = command.queryText.split(' ').slice(2).join(' ')
    let url = await ytsr(search, { limit: 5 })
    
    server.search = url.items
    
    let titles = ''

    for (index in url.items) {
      titles += `**${parseInt(index)+1}.** ${url.items[index].title}\n`
    }

    const embededMessage = new Discord.MessageEmbed()
      .setColor('#ffbc1f')
      .setTitle('**SEARCH RESULTS**')
      .setDescription(titles)

    await ctx.channel.send(embededMessage)
  }

  let server = servers[ctx.guild.id]

  // I had to use synonyms for some actions because
  // Dialogflow couldn't understand them clearly
  switch (command.action) {
    case 'Play':
      if (command.queryText.split(' ').length < 3) {
        await playQueue()
      } else {
        await addToQueue()
        await playQueue()
      }
      break
    
    case 'Include':
      if (command.queryText.split(' ').length < 3) return
      await addToQueue()
      break
    
    case 'Search':
      if (command.queryText.split(' ').length < 3) return
      await makeSearch()
      break

    case 'Stop':
      server.queue = []
      
      if (server.dispatcher) {
        server.dispatcher.destroy()
        ctx.channel.send('Stopping..')
      }
      break
    
    case 'Pause':
      if (!server.dispatcher.paused) server.dispatcher.pause()
      break
    
    case 'Resume':
      // Not working yet (for some reason)
      if (server.dispatcher.paused) server.dispatcher.resume()

    case 'Skip':
      if (server.dispatcher) {
        server.dispatcher.end()
        ctx.channel.send('Skipping..')
      }
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

  const command = ctx.content.slice(prefix.length).split()
  const action = command[0]
  const args = command.slice(1)

  switch (action) {
    case 'join':
      if (ctx.member.voice.channel) {
        const connection = await ctx.member.voice.channel.join()
        connection.play(new Silence(), { type: 'opus' })
        ctx.channel.send('I\'m listening.. My hotword is **bumblebee**.')

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
