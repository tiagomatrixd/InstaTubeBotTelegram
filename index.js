import { Telegraf, Markup } from 'telegraf';
import { igdl, youtube, twitter, fbdown, ttdl } from 'btch-downloader';
import dotenv from 'dotenv';
dotenv.config();


const bot = new Telegraf(process.env.BOT_TOKEN);

// Regex para detectar URLs
const urlPatterns = [
    /tiktok\.com|vm\.tiktok|vt\.tiktok/,
    /(youtube\.com|youtu\.be|music\.youtube\.com)/,
    /facebook\.com|fb\.watch/,
    /instagram\.com\/(p|reel|stories)/,
    /twitter\.com|x\.com/
  ];


function isYoutubeMusic(url) {
    return url.includes('music.youtube.com');
  }

// Função para processar dados específicos de cada plataforma
function parseMediaData(rawData, platform, url) {
  switch(platform) {
    case 'youtube':
       
      return  {
        url: isYoutubeMusic(url) ? rawData.mp3 : rawData.mp4, // MP3 direto para music.youtube
        mp3: rawData.mp3,
        caption: `🎵 ${rawData.title}`
      };

    case 'instagram':
      return {
        url: rawData[0]?.url, // Primeiro item do array
        caption: rawData[0]?.creator ? `📸 Por @${rawData[0].creator}` : '',
        thumbnail: rawData?.thumbnail,
      };

    case 'tiktok':
      // Adapte conforme a estrutura real do TikTok
      return {
        url: rawData.video,
        caption: '⬇️ Vídeo do TikTok',
        thumbnail: rawData?.thumbnail,
      };

    case 'facebook':
      return {
        url: rawData.hd || rawData.sd,
        caption: '📘 Vídeo do Facebook',
        thumbnail: rawData?.thumbnail,
      };

    case 'twitter':
        let videoUrl = '';
        const videos = rawData.url || [];
  
        // Prioriza HD > SD e pega o primeiro vídeo válido
        for (const video of videos) {
          if (video.hd) {
            videoUrl = video.hd;
            break;
          } else if (video.sd && !videoUrl) {
            videoUrl = video.sd;
          }
        }
  
        return {
          url: videoUrl,
          caption: rawData.creator ? `🐦 Por ${rawData.creator}` : rawData.title,
          thumbnail: rawData?.thumbnail,
          
        };
  

    default:
      return null;
  }
}

// Função de download principal
async function downloadMedia(url) {
  try {
    let data;
    if (urlPatterns[0].test(url)) {
      data = await ttdl(url);
      console.log(data);
      return parseMediaData(data, 'tiktok', url);
    }
    if (urlPatterns[1].test(url)) {
      data = await youtube(url);
      return parseMediaData(data, 'youtube', url);
    }
    if (urlPatterns[2].test(url)) {
      data = await fbdown(url);
      return parseMediaData(data, 'facebook', url);
    }
    if (urlPatterns[3].test(url)) {
      data = await igdl(url);
      return parseMediaData(data, 'instagram', url);
    }
    if (urlPatterns[4].test(url)) {
      data = await twitter(url);
      return parseMediaData(data, 'twitter', url);
    }
  } catch (error) {
    console.error('Erro no download:', error);
    return null;
  }
}

// Handler principal
bot.hears(urlPatterns, async (ctx) => {
    const url = ctx.message.text;
    const userMessageId = ctx.message.message_id;
  
    ctx.replyWithChatAction('upload_video');
  
    const mediaInfo = await downloadMedia(url);
    
    if (!mediaInfo?.url) {
      return 
    }
  
    // Botão MP3
    const buttons = [];
    if (mediaInfo.mp3) {
    console.log(mediaInfo);
    buttons.push([
        Markup.button.callback('⬇️ MP3', `mp3:${url}`)
      ])

    
    }

    
  
    if(isYoutubeMusic(url)){
        await ctx.replyWithAudio({ url: mediaInfo.mp3, filename: mediaInfo?.caption || 'Audio.mp3' });
       
    }else{
        await ctx.replyWithVideo(
            { url: mediaInfo.url },
            {
              caption: mediaInfo.caption,
              reply_markup: Markup.inlineKeyboard(buttons), // Sintaxe correta
              thumbnail: mediaInfo.thumbnail 
            }
          );
    }
   
  
    // Apaga a mensagem do usuário após 5 segundos
    setTimeout(async () => {
      await ctx.deleteMessage(userMessageId);
    }, 5000);
  });
  
  // Handler do botão MP3
  bot.action(/^mp3:(.+)/, async (ctx) => {
    const url = ctx.match[1];
    ctx.replyWithChatAction('upload_audio');
  
    const mediaInfo = await downloadMedia(url);
    
    if (mediaInfo?.mp3) {
      await ctx.replyWithAudio({ url: mediaInfo.mp3 });
      await ctx.deleteMessage(); // Remove o botão
    }
  });
  
  
  bot.launch();
  console.log('Bot está rodando...');