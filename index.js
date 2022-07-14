/**
 *  make sure you run "npm install" to install all packages before running "node .""
 */

/**
 * was gonna make it in typescript but too lazy complie & idk if yk how to use it.
 * usually i will have separate folder for commands, events, structures, utils, locales ,handlers and all
 * that but since this is just a simple bot imma just have it be in one file
 */

require('dotenv').config() // idk if u use enviroment variables but it just protects your tokens or anything secret from being leaked
const { Client } = require('discord.js') // best module for discord since it fully covers discord API
const { QuickDB } = require('quick.db') // personally i user mongodb to store data for my bot, and redis to cache the data in memory for better performance

const db = new QuickDB()

/**
 * idk when they switched to sqlite but just for later that json.sqlite file is where all the data is
 * stored and if you want the data to be the same on every host u must copy it, 
 * this is why i use mongodb since its cloud based
 * 
 * if the json.sqlite file isnt there it will be created when you run the process
 * 
 * delete it to reseet the bots data
 */

const client = new Client({
    intents: 32767,
    partials: [
        'MESSAGE'
    ]
})

client.on('error', async err  => {
    console.error(err)
})

client.on('debug', async message => {
    console.log(message)
})

process.on('uncaughtException', async () => {
    
})

process.on('uncaughtExceptionMonitor', async () => {
    
})

process.on('unhandledRejection', async () => {
    
})

client.on('ready', async client => {
    console.log(`[CLIENT] Logged in as ${client.user.tag}`)

    // registering slash command, note since these are global commands and not set for a specfic server like a test server they take like 30mins to a hour to be set
    client.application.commands.set([{
        name: 'enable',
        description: 'enable message deletion for a channel',
        options: [{
            type: 'CHANNEL',
            name: 'channel',
            description: 'channel to be enabled',
            channelTypes: ['GUILD_TEXT'],
            required: true
        }],
        type: 'CHAT_INPUT'
    }, {
        name: 'disable',
        description: 'enable message deletion for a channel',
        type: 'CHAT_INPUT'
    }], '996595202288529428'/** this is where you would put the guild id, if you wanted these commands just for a specific server */)
})

client.on('guildCreate', async guild => {

    if (db.has(`guild:${guild.id}`)) await db.delete(`guild:${guild.id}`) // deleting data if it hasnt yet been deleted

    // its best practiced when using a key based database to have the key organized by most specific (usually a suffix) in front of the : and least specific behind (usually an id or token)
    await db.set(`guild:${guild.id}`, {
        channel: undefined
    })
})

client.on('guildDelete', async guild => {
    // deleting unescessary data
    if (db.has(`guild:${guild.id}`)) await db.delete(`guild:${guild.id}`)
})

client.on('guildMemberRemove', async member => {
    const data = await db.get(`guild:${member.guild.id}`)
    if (!data) return

    if (data.channel) {
        const channel = member.guild.channels.cache.get(data.channel)
        if (!channel) return

        try { // since bulkdelete can act weird when deleting a very large amout of message due to Discord API and rate limits
            await channel.messages.fetch({ limit: 100 /** 100 is the limit, you can prouably loop through this to get more tho, just make sure you dont get rate limited :/ */ , cache: true}).then(msgs => {
                const messages = []

                msgs.filter(msg => {
                    if (msg.author.id === member.id) messages.push(msg)
                })

                channel.bulkDelete(messages, true)
            })
        } catch(e) {
            console.error(e)
        }
    }
})

client.on('messageCreate', async message => {

    const { member, guild } = message

    if (!guild) return // no guild most the time means its in dms

    // i dont suggest using message commands as message intent is going to be priveleged soon, however imma just use it for this
    const data = await db.get(`guild:${guild.id}`)
    if (!data) return

    prefix = process.env.PREIFX || ','

    if (!message.content.startsWith(prefix)) return

    // parsing message
    const [ name, ...args ] = message.content.slice(prefix.length).split(/ +/g)

    // checking member  permissions since both commands need the same permission
    if (!member.permissions.has('MANAGE_GUILD')) return message.channel.send({
        embeds: [{
            color: 0x2f3137,
            description: `${member}: You need the **MANAGE SERVER** permission to use this command`
        }]
    })

    // usually i would make a command handler if the im going to have lots of commands
    if (name.toLocaleLowerCase() === 'enable') {

        if (!args[0]) return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: Please **provide a channel**`
            }]
        })

        // searching for channel based on arguments
        const channel = guild.channels.cache.find(c => c.id === args[0] || c.name.toLocaleLowerCase() === args[0])

        if (!channel) return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: Was unable to find any channel by the ID or name of **${args[0]}**`
            }]
        })

        // making sure the channel is actuallt a text channel
        if (!channel.isText()) return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: ${channel} is not a **text based channel**`
            }]
        })

        if (data.channel && channel.id === data.channel) return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: Message deletion is **already enabled** for ${channel}`
            }]
        })

        data.channel = `${channel.id}`

        await db.set(`guild:${guild.id}`, data) // update guild data

        return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: Message deletion has **been enabled** for ${channel}`
            }]
        })
    } else if (name.toLocaleLowerCase() === 'disable') {
        
        if (!data.channel) return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: Message deletion is **already disabled**`
            }]
        })

        data.channel = undefined

        await db.set(`guild:${guild.id}`, data)

        return message.channel.send({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: Message deletion has been **disabled**`
            }]
        })
    }
})

client.on('interactionCreate', async interaction => {
    // idk if your familiar with interactions (slash commands) but i decided to add them since im bored :)

    if (interaction.isCommand()) {
        const data = await db.get(`guild:${interaction.guild.id}`)
        if (!data) return

        const { member } = interaction

        if (!interaction.member.permissions.has('MANAGE_GUILD')) return interaction.reply({
            embeds: [{
                color: 0x2f3137,
                description: `${member}: You need the **MANAGE SERVER** permission to use this command`
            }],
            ephemeral: true // this is so the message appears only for the user that called the command, typically used for errors
        })

        if (interaction.command.name === 'enable') {
            const channel = interaction.options.data[0].channel // since there is only one option and its a required option, it will always the the first element in the array

            if (data.channel && channel.id === data.channel) return interaction.reply({
                embeds: [{
                    color: 0x2f3137,
                    description: `${member}: Message deletion is **already enabled** for ${channel}`
                }],
                ephemeral: true
            })

            data.channel = `${channel.id}`

            await db.set(`guild:${interaction.guild.id}`, data)

            // if you dont reply to your command or defer reply in a certain amount of time the user will get a "application did not respond" response and you wont be able to reply anymore
            return interaction.reply({
                embeds: [{
                    color: 0x2f3137,
                    description: `${member}: Message deletion has **been enabled** for ${channel}`
                }]
            })
        } else if (interaction.command.name === 'disable') {
            if (!data.channel) return interaction.reply({
                embeds: [{
                    color: 0x2f3137,
                    description: `${member}: Message deletion is **already disabled**`
                }],
                ephemeral: true
            })
    
            data.channel = undefined
    
            await db.set(`guild:${interaction.guild.id}`, data)
    
            return interaction.reply({
                embeds: [{
                    color: 0x2f3137,
                    description: `${member}: Message deletion has been **disabled**`
                }]
            })
        }
    }
})

client.login(process.env.TOKEN) // 