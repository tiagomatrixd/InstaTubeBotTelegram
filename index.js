import { Telegraf, Markup } from 'telegraf';
import { igdl, twitter, fbdown, ttdl } from 'btch-downloader';
import axios from 'axios';
import crypto from 'crypto';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
dotenv.config();


const bot = new Telegraf(process.env.BOT_TOKEN);

// Regex para detectar URLs
const urlPatterns = [
    /tiktok\.com|vm\.tiktok|vt\.tiktok/,
    /(youtube\.com|youtu\.be|music\.youtube\.com)/,
    /facebook\.com|fb\.watch/,
    /instagram\.com\/(p|reel|stories)/,
    /threads\.com\/@[\w\.]+\/post\/[\w-]+|threads\.com\/t\/[\w-]+/,
    /twitter\.com|x\.com/
  ];


function isYoutubeMusic(url) {
    return url.includes('music.youtube.com');
}

// Função para identificar a plataforma do URL
function identifyPlatform(url) {
  if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(url)) return 'tiktok';
  if (/(youtube\.com|youtu\.be|music\.youtube\.com)/.test(url)) return 'youtube';
  if (/facebook\.com|fb\.watch/.test(url)) return 'facebook';
  if (/instagram\.com\/(p|reel|stories)/.test(url)) return 'instagram';
  if (/threads\.com/.test(url)) return 'threads';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  return 'unknown';
}

// Funções para gerar timestamp e footer do YouTube
function generateTimeStampYoutubeDL() {
    return Date.now().toString();
}

function generateFooterYoutubeDL(timestamp, link) {
    const locale = 'en';
    const secretKey = '6HTugjCXxR';
    const input = link + locale + timestamp + secretKey;
    const hash = crypto.createHash('md5').update(input).digest('hex');
    return hash;
}

// Função para delay entre tentativas
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// User agents rotativos para evitar detecção
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Função para extrair ID do Threads da URL
function extractThreadsId(url) {
  // Padrões possíveis de URL do Threads:
  // https://threads.com/@username/post/abc123
  // https://threads.com/t/abc123
  const patterns = [
    /threads\.com\/@[\w\.]+\/post\/([\w-]+)/,
    /threads\.com\/t\/([\w-]+)/,
    /threads\.net\/@[\w\.]+\/post\/([\w-]+)/,
    /threads\.net\/t\/([\w-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Função para baixar do Threads usando threadster.app
async function threadster(id) {
  try {
    console.log(`🧵 Baixando Threads ID: ${id}`);
    
    // Enviando requisição GET para threadster.app
    const response = await axios.get(`https://threadster.app/download/${id}`, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });

    // Carregando HTML no cheerio para scraping
    const $ = cheerio.load(response.data);

    // Scraping dos elementos da página
    const profile = $('.download_item_profile_pic img').attr('src');
    const caption = $('.download_itemcaption_text').text().trim();
    const download = $('.download_iteminfoactions_button').attr('href');
    const resolution = $('table tr:nth-child(2) td:first-child').text();

    // Verificar se encontrou o link de download
    if (!download) {
      throw new Error('Link de download não encontrado na página');
    }

    console.log(`✅ Threads baixado com sucesso - Resolução: ${resolution}`);

    // Retornando dados estruturados
    return {
      profile: {
        picture: profile,
      },
      content: {
        caption: caption || '',
        download: {
          link: download,
          resolution: resolution || 'Desconhecida',
        },
      },
    };
  } catch (error) {
    console.error('❌ Erro ao baixar do Threads:', error.message);
    
    // Retornando informações de erro detalhadas
    return {
      error: 'Error scraping page',
      message: error.message,
      responseStatus: error.response ? error.response.status : null,
      responseHeaders: error.response ? error.response.headers : null,
    };
  }
}

// Nova função YouTube usando a API snapany.com com hash MD5 e retry logic
function youtubeSnapany(youtubeUrl, retryCount = 0) {
  return new Promise(async (resolve, reject) => {
    const youtubeRegex = /(?:http(?:s|):\/\/|)(?:(?:www\.|)youtube(?:\-nocookie|)\.com\/(?:watch\?.*(?:|\&)v=|embed\/|v\/)|youtu\.be\/)([-_0-9A-Za-z]{11})/;
    
    if (!youtubeRegex.test(youtubeUrl)) {
      return reject("Invalid YouTube URL");
    }

    const timestamp = generateTimeStampYoutubeDL();
    const footer = generateFooterYoutubeDL(timestamp, youtubeUrl);

    const payload = {
      link: youtubeUrl,
    };

    const headers = {
      'user-agent': getRandomUserAgent(),
      'g-footer': footer,
      'g-timestamp': timestamp,
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,pt;q=0.8',
      'content-type': 'application/json',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'origin': 'https://snapany.com',
      'referer': 'https://snapany.com/',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'cookie': 'CONSENT=PENDING+987; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; YSC=DjWU7g6yTUQ; VISITOR_INFO1_LIVE=Uakgb_J5c9o; _ga=GA1.1.123456789.1234567890; _ga_RYZKMF6NRR=GS1.1.1234567890.1.1.1234567890.0.0.0',
      'x-forwarded-for': `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      'x-real-ip': `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    };

    console.log(`Tentativa ${retryCount + 1} - YouTube API para: ${youtubeUrl}`);
    console.log(`User-Agent: ${headers['user-agent']}`);
    
    axios.post('https://api.snapany.com/v1/extract', payload, { 
      headers,
      timeout: 30000, // 30 segundos de timeout
      maxRedirects: 5
    })
    .then(response => {
      const data = response.data;
      
      if (!data.medias || data.medias.length === 0) {
        return reject("No media found");
      }

      // Encontrar o vídeo e áudio
      const videoMedia = data.medias.find(media => media.media_type === "video");
      const audioMedia = data.medias.find(media => media.media_type === "audio");

      if (!videoMedia) {
        return reject("No video found");
      }

      // Organizar os formatos de vídeo por qualidade
      const videoFormats = videoMedia.formats ? videoMedia.formats.sort((a, b) => b.quality - a.quality) : [];
      
      // Pegar a melhor qualidade disponível (ou usar resource_url como fallback)
      const bestVideo = videoFormats.length > 0 ? videoFormats[0] : null;
      const videoUrl = bestVideo ? bestVideo.video_url : videoMedia.resource_url;
      const videoQuality = bestVideo ? bestVideo.quality_note : "360p";

      // Extrair ID do vídeo da URL
      const videoIdMatch = youtubeRegex.exec(youtubeUrl);
      const videoId = videoIdMatch ? videoIdMatch[1] : "";

      const result = {
        id: videoId,
        title: data.text || "Unknown Title",
        thumbnail: videoMedia.preview_url || "",
        mp4: videoUrl,
        mp3: audioMedia ? audioMedia.resource_url : "",
        quality: videoQuality,
        size: bestVideo ? `${Math.round(bestVideo.video_size / 1024 / 1024)} MB` : "",
        size_mp3: audioMedia ? `${Math.round(audioMedia.video_size / 1024 / 1024)} MB` : "",
        formats: videoFormats.map(format => ({
          quality: format.quality_note,
          url: format.video_url,
          size: `${Math.round(format.video_size / 1024 / 1024)} MB`,
          ext: format.video_ext
        })),
        creator: "@TioXd"
      };

      console.log('YouTube API Result:', {
        id: result.id,
        title: result.title,
        hasMP4: !!result.mp4,
        hasMP3: !!result.mp3,
        mp3Url: result.mp3 ? result.mp3.substring(0, 100) + '...' : 'N/A',
        audioMediaFound: !!audioMedia,
        audioResourceUrl: audioMedia ? audioMedia.resource_url.substring(0, 100) + '...' : 'N/A'
      });

      resolve(result);
    })
    .catch(async error => {
      console.error(`Tentativa ${retryCount + 1} falhou:`, error.response?.status, error.response?.statusText);
      
      // Se é erro de rate limiting (429) ou erro de servidor (5xx), tenta novamente
      if (retryCount < 2 && (error.response?.status === 429 || error.response?.status >= 500)) {
        console.log(`Aguardando ${(retryCount + 1) * 2000}ms antes da próxima tentativa...`);
        await delay((retryCount + 1) * 2000); // Delay progressivo: 2s, 4s
        return youtubeSnapany(youtubeUrl, retryCount + 1).then(resolve).catch(reject);
      }
      
      // Se é erro 403 (Forbidden), pode ser bloqueio geográfico
      if (error.response?.status === 403) {
        return reject("Acesso negado - possível bloqueio geográfico ou de IP. Tente novamente mais tarde.");
      }
      
      reject("Failed to extract video information: " + (error.response?.data?.message || error.message));
    });
  });
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
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
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
        caption: `🎵 ${rawData.title}`,
        thumbnail: rawData.thumbnail
      };

    case 'instagram':
      console.log('Instagram rawData:', rawData);
      const firstItem = rawData[0];
      if (!firstItem) return null;
      
      // Detecta se é imagem ou vídeo baseado em múltiplos critérios
      const itemUrl = firstItem.url || '';
      const isImage = firstItem.type === 'image' || 
                     firstItem.type === 'photo' ||
                     // Verifica extensões de imagem na URL (mesmo dentro de tokens/proxies)
                     itemUrl.includes('.jpg') || 
                     itemUrl.includes('.jpeg') || 
                     itemUrl.includes('.png') || 
                     itemUrl.includes('.webp') ||
                     // Se não tem duração E não contém indicadores de vídeo
                     (!firstItem.duration && !itemUrl.includes('.mp4') && !itemUrl.includes('video'));
      
      return {
        url: firstItem.url,
        caption: firstItem.creator ? `📸 Por @InstaTikTubbot` : '📸 Instagram',
        thumbnail: rawData?.thumbnail,
        isImage: isImage,
        mediaType: isImage ? 'photo' : 'video',
        needsTypeDetection: true // Flag para indicar que precisa de detecção adicional
      };

    case 'threads':
      console.log('Threads rawData:', rawData);
      
      // Verifica se houve erro no scraping
      if (rawData.error) {
        console.error('Erro no Threads:', rawData.message);
        return null;
      }
      
      const threadsContent = rawData.content;
      if (!threadsContent?.download?.link) {
        console.error('Link de download não encontrado');
        return null;
      }
      
      return {
        url: threadsContent.download.link,
        caption: threadsContent.caption ? `🧵 ${threadsContent.caption}` : '🧵 Threads Meta',
        thumbnail: rawData.profile?.picture || null,
        resolution: threadsContent.download.resolution,
        isImage: false, // Threads geralmente são vídeos
        mediaType: 'video',
        needsTypeDetection: true
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
      data = await youtubeSnapany(url);
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
      // Extrai ID do Threads da URL
      const threadsId = extractThreadsId(url);
      if (!threadsId) {
        console.error('❌ Não foi possível extrair ID do Threads da URL:', url);
        return null;
      }
      
      console.log(`🔍 ID extraído do Threads: ${threadsId}`);
      data = await threadster(threadsId);
      return parseMediaData(data, 'threads', url);
    }
    if (urlPatterns[5].test(url)) {
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
    const platform = identifyPlatform(url);
    
    console.log(`📱 URL detectada - Plataforma: ${platform.toUpperCase()}`);
  
    ctx.replyWithChatAction('upload_video');
  
    const mediaInfo = await downloadMedia(url);
    
    if (!mediaInfo?.url) {
      return 
    }

    // Para Instagram e Threads, faz detecção adicional se necessário
    if ((url.includes('instagram.com') || url.includes('threads.com')) && mediaInfo.needsTypeDetection) {
      const detectedType = await detectMediaType(mediaInfo.url);
      mediaInfo.isImage = detectedType === 'photo';
      mediaInfo.mediaType = detectedType === 'unknown' ? mediaInfo.mediaType : detectedType;
      const platform = url.includes('threads.com') ? 'Threads' : 'Instagram';
      console.log(`Tipo detectado para ${platform}: ${detectedType}`);
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
        // Verifica se é uma imagem do Instagram ou Threads
        if(mediaInfo.isImage && (url.includes('instagram.com') || url.includes('threads.com'))){
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
                // Se falhar como vídeo, tenta como foto (fallback para Instagram/Threads)
                if(url.includes('instagram.com') || url.includes('threads.com')){
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
    
    try {
      await ctx.answerCbQuery('🔄 Baixando áudio...');
      ctx.replyWithChatAction('upload_audio');
    
      const mediaInfo = await downloadMedia(url);
      
      if (!mediaInfo?.mp3) {
        await ctx.answerCbQuery('❌ Erro ao obter áudio', { show_alert: true });
        return;
      }

      // Log da URL do MP3 para debug
      console.log('MP3 URL encontrada:', mediaInfo.mp3 ? 'Sim' : 'Não');

      const formattedCaption = formatCaption(mediaInfo.caption || '🎵 Áudio', user, url);
      
      // Sanitiza o filename removendo caracteres especiais
      const sanitizedTitle = (mediaInfo.caption || 'Audio').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const filename = `${sanitizedTitle}.mp3`;
      
      // Tenta enviar como áudio primeiro
      try {
        await ctx.replyWithAudio(
          { url: mediaInfo.mp3, filename: filename },
          { 
            caption: formattedCaption,
            parse_mode: 'Markdown'
          }
        );
        await ctx.deleteMessage(); // Remove o botão apenas se o envio foi bem-sucedido
      } catch (audioError) {
        console.log('Erro ao enviar como áudio, tentando como documento:', audioError.message);
        
        // Fallback: tenta enviar como documento
        try {
          await ctx.replyWithDocument(
            { url: mediaInfo.mp3, filename: filename },
            { 
              caption: formattedCaption,
              parse_mode: 'Markdown'
            }
          );
          await ctx.deleteMessage();
        } catch (documentError) {
          console.error('Erro ao enviar como documento:', documentError.message);
          throw documentError; // Re-throw para ser capturado pelo catch principal
        }
      }
      
    } catch (error) {
      console.error('Erro no handler MP3:', error);
      await ctx.answerCbQuery('❌ Erro ao enviar áudio', { show_alert: true });
      
      // Se chegou até aqui, significa que tanto áudio quanto documento falharam
      await ctx.reply(`❌ Não foi possível baixar o áudio.\nMotivo: ${error.message}\n\nTente novamente mais tarde ou use outro link.`);
    }
  });
  
  
  bot.launch();
  console.log('Bot está rodando...');