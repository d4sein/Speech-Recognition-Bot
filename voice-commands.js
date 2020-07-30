const fs = require('fs')

const ytdl = require('ytdl-core')
const ytsr = require('ytsr')
ytsr.do_warn_deprecate = false


let config = JSON.parse(fs.readFileSync('config.json'))
let servers = new Map()

class Server {
  constructor() {
    this.queue = []
    this.dispatcher = null
    this.search = null
  }
}

class Song {
  constructor(title, link, duration) {
    this.title = title
    this.link = link
    this.duration = duration
  }
}

async function handleVoiceCommands(command, connection, ctx) {
  // Debug
  console.log(command.queryText + ' -> ' + command.action)
  if (!servers.has(ctx.guild.id)) servers.set(ctx.guild.id, new Server())

  async function playQueue() {
    let server = servers.get(ctx.guild.id)
    
    if (!server.queue.length) return
    let song = server.queue[0]

    server.dispatcher = connection.play(ytdl(song.link, { filter: 'audioonly' }, () => {}, true))
    ctx.channel.send(`Playing.. **${song.title}**`)

    server.dispatcher.on('finish', function () {
      server.queue.shift()

      if (server.queue.length) {
        setTimeout(playQueue, 1500)
      }
    })
  }


  async function addToQueue() {
    let server = servers.get(ctx.guild.id)
    let song

    if (server.search) {
      // When the user makes a search before instructing the bot what to play
      const deny = ['do not', 'don\'t']

      if (deny.some(s => command.queryText.includes(s))) {
        // If the user cancels the search
        ctx.channel.send('Canceling search..')

        server.search = null
        return
      }

      let options

      if (config.language == 'en') {
        options = [
          ['first', 'one','1'],
          ['second', 'two','2'],
          ['third', 'three', '3'],
          ['fourth', 'four', '4'],
          ['fifth', 'five', '5']
        ]
      } else if (config.language == 'pt-BR') {
        options = [
          ['primeira', 'um','1'],
          ['segunda', 'dois','2'],
          ['terceira', 'três', '3'],
          ['quarta', 'quatro', '4'],
          ['quinta', 'cinco', '5']
        ] 
      }

      const index = options.findIndex(arr => arr.some(s => command.queryText.toLowerCase().includes(s)))

      if (index >= 0) {
        // If the user gives a valid option
        song = server.search[index]
        server.search = null
      }

    } else {
      // When the user directly instructs the bot what to play
      let search = command.queryText.split(' ').slice(2).join(' ')
      song = await ytsr(search, { limit: 1 })
      song = song.items[0]
    }

    server.queue.push(new Song(song.title, song.link, song.duration))
    ctx.channel.send(`Queueing.. **${song.title}**`)
  }

  
  async function makeSearch() {
    let server = servers.get(ctx.guild.id)

    let search = command.queryText.split(' ').slice(2).join(' ')
    let url = await ytsr(search, { limit: 5 })
    
    server.search = url.items
    
    let result = '**SEARCH RESULTS**\n\n'
    for (index in url.items) {
      result += `**${parseInt(index)+1}.** ${url.items[index].title}\n`
    }

    await ctx.channel.send(result)
  }

  let server = servers.get(ctx.guild.id)
  command.queryText = command.queryText.toLowerCase()

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
    
    // Queue
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
        ctx.channel.send(command.fulfillmentText)
      }
      break
    
    case 'Pause':
      if (!server.dispatcher.paused) {
        server.dispatcher.pause()
        ctx.channel.send(command.fulfillmentText)
      }
      break
    
    case 'Resume':
      if (server.dispatcher.paused) {
        server.dispatcher.resume()
        ctx.channel.send(command.fulfillmentText)
      }
      break

    case 'Skip':
      if (server.dispatcher) {
        server.dispatcher.end()
        ctx.channel.send(command.fulfillmentText)
      }
      break

    case 'Change':
      if (['language', 'lingua', 'idioma']
        .some(s => command.queryText.includes(s))) {

        if (['portuguese', 'português']
          .some(s => command.queryText.includes(s))) {

            config.language = 'pt-BR'
            ctx.channel.send('Mudei o reconhecimento de voz para Português.')
        } else if (['english', 'inglês']
          .some(s => command.queryText.includes(s))) {

            config.language = 'en'
            ctx.channel.send('I changed the speech recognition to English.')
        }

        let data = JSON.stringify(config)
        fs.writeFileSync('config.json', data)
      }
      break

    default:
      break
  }
}

module.exports = { handleVoiceCommands }
