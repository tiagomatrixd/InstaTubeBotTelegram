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

// Função para detectar tipo de mídia por Content-Type
async function detectMediaType(url) {
  try {
    // Primeiro, tenta extrair informações do token JWT se existir
    if (url.includes('token=')) {
      try {
        const tokenMatch = url.match(/token=([^&]+)/);
        if (tokenMatch) {
          const token = tokenMatch[1];
          // Decodifica o payload do JWT (parte do meio)
          const payload = token.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
          
          if (decodedPayload.filename) {
            console.log(`Filename no token: ${decodedPayload.filename}`);
            const filename = decodedPayload.filename.toLowerCase();
            if (filename.includes('.jpg') || filename.includes('.jpeg') || 
                filename.includes('.png') || filename.includes('.webp')) {
              console.log('Detectado como imagem pelo filename do token');
              return 'photo';
            } else if (filename.includes('.mp4') || filename.includes('.mov') || 
                      filename.includes('.avi')) {
              console.log('Detectado como vídeo pelo filename do token');
              return 'video';
            }
          }
        }
      } catch (tokenError) {
        console.log('Erro ao decodificar token:', tokenError.message);
      }
    }

    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'User-Agent': 'TelegramBot (like TwitterBot)'
      }
    });
    const contentType = response.headers.get('content-type') || '';
    
    console.log(`Content-Type detectado: ${contentType}`);
    
    if (contentType.startsWith('image/')) {
      return 'photo';
    } else if (contentType.startsWith('video/')) {
      return 'video';
    }
    
    // Fallback para análise da URL (mesmo dentro de tokens)
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
        urlLower.includes('.png') || urlLower.includes('.webp') ||
        urlLower.includes('image') || urlLower.includes('photo')) {
      return 'photo';
    } else if (urlLower.includes('.mp4') || urlLower.includes('.mov') || 
               urlLower.includes('.avi') || urlLower.includes('video')) {
      return 'video';
    }
    
    return 'unknown';
  } catch (error) {
    console.log('Erro ao detectar tipo de mídia:', error.message);
    // Fallback para análise da URL em caso de erro
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
        urlLower.includes('.png') || urlLower.includes('.webp')) {
      return 'photo';
    }
    return 'video'; // Default para vídeo se não conseguir determinar
  }
}

// Função para formatar a legenda com o usuário e link original
function formatCaption(originalCaption, user, originalUrl) {
  const userMention = user.username ? `@${user.username}` : user.first_name;
  const userLink = `[${userMention}](tg://user?id=${user.id})`;
  
  return `${originalCaption}\n\n📤 Enviado por: ${userLink}\n🔗 [Link original](${originalUrl})`;
}

// Função para processar dados específicos de cada plataforma
function parseMediaData(rawData, platform, url) {
  switch(platform) {
    case 'youtube':
      console.log('YouTube rawData:', rawData);
      return  {
        url: isYoutubeMusic(url) ? rawData.mp3 : rawData.mp4, // MP3 direto para music.youtube
        mp3: rawData.mp3,
        caption: `🎵 ${rawData.title}`
      };

    case 'instagram':
      console.log('Instagram rawData:', rawData);
      const firstItem = rawData[0];
      if (!firstItem) return null;
      
      // Detecta se é imagem ou vídeo baseado em múltiplos critérios
      const url = firstItem.url || '';
      const isImage = firstItem.type === 'image' || 
                     firstItem.type === 'photo' ||
                     // Verifica extensões de imagem na URL (mesmo dentro de tokens/proxies)
                     url.includes('.jpg') || 
                     url.includes('.jpeg') || 
                     url.includes('.png') || 
                     url.includes('.webp') ||
                     // Se não tem duração E não contém indicadores de vídeo
                     (!firstItem.duration && !url.includes('.mp4') && !url.includes('video'));
      
      return {
        url: firstItem.url,
        caption: firstItem.creator ? `📸 Por @InstaTikTubbot` : '📸 Instagram',
        thumbnail: rawData?.thumbnail,
        isImage: isImage,
        mediaType: isImage ? 'photo' : 'video',
        needsTypeDetection: true // Flag para indicar que precisa de detecção adicional
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
          caption: `🐦 Por @InstaTikTubbot`,
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
    const user = ctx.from;
  
    ctx.replyWithChatAction('upload_video');
  
    const mediaInfo = await downloadMedia(url);
    
    if (!mediaInfo?.url) {
      return 
    }

    // Para Instagram, faz detecção adicional se necessário
    if (url.includes('instagram.com') && mediaInfo.needsTypeDetection) {
      const detectedType = await detectMediaType(mediaInfo.url);
      mediaInfo.isImage = detectedType === 'photo';
      mediaInfo.mediaType = detectedType === 'unknown' ? mediaInfo.mediaType : detectedType;
      console.log(`Tipo detectado para Instagram: ${detectedType}`);
    }

    // Formata a legenda com informações do usuário e link original
    const formattedCaption = formatCaption(mediaInfo.caption || '', user, url);
  
    // Botão MP3
    const buttons = [];
    if (mediaInfo.mp3) {
    console.log(mediaInfo);
    buttons.push([
        Markup.button.callback('⬇️ MP3', `mp3:${url}`)
      ])

    
    }

    
  
    if(isYoutubeMusic(url)){
        await ctx.replyWithAudio(
          { url: mediaInfo.mp3, filename: mediaInfo?.caption || 'Audio.mp3' },
          { 
            caption: formattedCaption,
            parse_mode: 'Markdown'
          }
        );
       
    }else{
        // Verifica se é uma imagem do Instagram
        if(mediaInfo.isImage && url.includes('instagram.com')){
            try {
                await ctx.replyWithPhoto(
                    { url: mediaInfo.url },
                    {
                      caption: formattedCaption,
                      parse_mode: 'Markdown'
                    }
                  );
            } catch (error) {
                console.log('Erro ao enviar como foto, tentando como vídeo:', error.message);
                // Se falhar como foto, tenta como vídeo
                await ctx.replyWithVideo(
                    { url: mediaInfo.url },
                    {
                      caption: formattedCaption,
                      parse_mode: 'Markdown',
                      thumbnail: mediaInfo.thumbnail 
                    }
                  );
            }
        } else {
            try {
                await ctx.replyWithVideo(
                    { url: mediaInfo.url },
                    {
                      caption: formattedCaption,
                      parse_mode: 'Markdown',
                      thumbnail: mediaInfo.thumbnail 
                    }
                  );
            } catch (error) {
                console.log('Erro ao enviar como vídeo, tentando como foto:', error.message);
                // Se falhar como vídeo, tenta como foto (fallback para Instagram)
                if(url.includes('instagram.com')){
                    await ctx.replyWithPhoto(
                        { url: mediaInfo.url },
                        {
                          caption: formattedCaption,
                          parse_mode: 'Markdown'
                        }
                      );
                }
            }
        }
          
          if(url.includes('youtube.com') || url.includes('youtu.be')){
            await ctx.reply(
                '🔽 Baixe o áudio separadamente:',
                Markup.inlineKeyboard([
                  Markup.button.callback('⬇️ MP3', `mp3:${url}`)
                ])
            );
          } 
         
        
    }
   
  
    // Apaga a mensagem do usuário após 5 segundos
    setTimeout(async () => {
      await ctx.deleteMessage(userMessageId);
    }, 5000);
  });
  
  // Handler do botão MP3
  bot.action(/^mp3:(.+)/, async (ctx) => {
    const url = ctx.match[1];
    const user = ctx.from;
    ctx.replyWithChatAction('upload_audio');
  
    const mediaInfo = await downloadMedia(url);
    
    if (mediaInfo?.mp3) {
      const formattedCaption = formatCaption(mediaInfo.caption || '🎵 Áudio', user, url);
      
      await ctx.replyWithAudio(
        { url: mediaInfo.mp3, filename: mediaInfo?.caption || 'Audio.mp3' },
        { 
          caption: formattedCaption,
          parse_mode: 'Markdown'
        }
      );
      await ctx.deleteMessage(); // Remove o botão
    }
  });
  
  
  bot.launch();
  console.log('Bot está rodando...');