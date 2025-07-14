import { Telegraf, Markup } from 'telegraf';
import { igdl, twitter, fbdown, ttdl } from 'btch-downloader';
import axios from 'axios';
import crypto from 'crypto';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ID do dono do bot (substitua pelo seu ID do Telegram)
const OWNER_ID = process.env.OWNER_ID || 165384194; // Seu ID do Telegram

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
  // https://www.threads.com/@username/post/abc123
  const patterns = [
    /threads\.com\/@[\w\.]+\/post\/([\w-]+)/,
    /threads\.com\/t\/([\w-]+)/,
    /www\.threads\.com\/@[\w\.]+\/post\/([\w-]+)/,
    /www\.threads\.com\/t\/([\w-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Função para construir URL completa do Threads
function buildThreadsUrl(originalUrl, id) {
  // Se a URL original já contém o username, usa ela
  const usernameMatch = originalUrl.match(/@([\w\.]+)\/post/);
  if (usernameMatch) {
    const username = usernameMatch[1];
    return `https://www.threads.com/@${username}/post/${id}`;
  }
  
  // Fallback para formato simples
  return `https://www.threads.com/t/${id}`;
}

// Função para baixar do Threads usando threadster.app
async function threadster(originalUrl, id) {
  try {
    console.log(`🧵 Baixando Threads ID: ${id}`);
    
    // Constrói a URL completa do Threads
    const threadsUrl = buildThreadsUrl(originalUrl, id);
    console.log(`🔗 URL do Threads: ${threadsUrl}`);

    const formData = new URLSearchParams();
    formData.append('url', originalUrl);
    
    // Enviando requisição POST para threadster.app
    const response = await axios.post('https://threadster.app/download', 
      formData.toString(), // Dados do formulário
      {
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
          'cache-control': 'max-age=0',
          'content-type': 'application/x-www-form-urlencoded',
          'cookie': '_csrf=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTI1MzIxMzQsImV4cCI6MTc1MjUzNTczNH0.Q-9vTftj86jOdbOo5DWt6ZwBJX25eJpfKxRN_5_F654',
          'origin': 'null',
          'priority': 'u=0, i',
          'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
        },
        timeout: 20000,
        maxRedirects: 5
      }
    );

    // Carregando HTML no cheerio para scraping
    const $ = cheerio.load(response.data);
    
    // Scraping dos elementos da página baseado na estrutura real do threadster.app
    const profile = $('.download__item__profile_pic img').attr('src') || 
                   $('.download_item_profile_pic img').attr('src') ||
                   $('img[alt*="profile"]').attr('src');
                   
    const username = $('.download__item__profile_pic div span').text().trim() ||
                    $('.download__item__user_info span').text().trim() ||
                    $('[class*="profile"] span').text().trim();
                   
    const caption = $('.download__item__caption__text').text().trim() || 
                   $('.download_item_caption_text').text().trim() ||
                   $('.caption__text').text().trim();
                   
    const download = $('.download__item__info__actions__button').attr('href') || 
                    $('.download_item_info_actions_button').attr('href') ||
                    $('a.btn[href*="downloads.acxcdn.com"]').attr('href') ||
                    $('table a.btn').attr('href') ||
                    $('a[href*=".mp4"]').attr('href');
                    
    const resolution = $('table tr:nth-child(2) td:first-child').text().trim() ||
                      $('table td').first().text().trim() ||
                      'HD';

    console.log(`🔍 Scraping concluído:`);
    console.log(`  - Profile: ${!!profile} (${profile?.substring(0, 80)}...)`);
    console.log(`  - Username: ${username}`);
    console.log(`  - Caption: ${caption?.substring(0, 100)}...`);
    console.log(`  - Download: ${!!download} (${download?.substring(0, 80)}...)`);
    console.log(`  - Resolution: ${resolution}`);
    // Verificar se encontrou o link de download
    if (!download) {
      console.log(`❌ HTML recebido para debug:\n${response.data.substring(0, 2000)}...`);
      throw new Error('Link de download não encontrado na página');
    }

    console.log(`✅ Threads baixado com sucesso - Resolução: ${resolution}`);

    // Retornando dados estruturados
    return {
      profile: {
        picture: profile,
        username: username || 'Unknown User'
      },
      content: {
        caption: caption || '',
        download: {
          link: download,
          resolution: resolution || 'HD',
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

// Função para escapar caracteres especiais do Markdown
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Função para formatar a legenda com o usuário e link original
function formatCaption(originalCaption, user, originalUrl) {
  const userMention = user.username ? `@${user.username}` : user.first_name;
  
  // Escapa caracteres especiais na legenda original
  const safeCaptionText = escapeMarkdown(originalCaption);
  const safeUserMention = escapeMarkdown(userMention);
  
  // Para o link, vamos usar texto simples ao invés de link clicável para evitar problemas
  return `${safeCaptionText}\n\n📤 Enviado por: ${safeUserMention}\n🔗 Link original: ${originalUrl}`;
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
      const threadsProfile = rawData.profile;
      
      if (!threadsContent?.download?.link) {
        console.error('Link de download não encontrado');
        return null;
      }
      
      // Legenda simples apenas com identificação da plataforma e usuário
      let threadsCaption = '🧵 Threads';
      if (threadsProfile?.username) {
        threadsCaption += ` por ${threadsProfile.username}`;
      }
      
      return {
        url: threadsContent.download.link,
        caption: threadsCaption,
        thumbnail: threadsProfile?.picture || null,
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
      data = await threadster(url, threadsId); // Passa a URL original e o ID
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
            caption: formattedCaption
          }
        );
       
    }else{
        // Verifica se é uma imagem do Instagram ou Threads
        if(mediaInfo.isImage && (url.includes('instagram.com') || url.includes('threads.com'))){
            try {
                await ctx.replyWithPhoto(
                    { url: mediaInfo.url },
                    {
                      caption: formattedCaption
                    }
                  );
            } catch (error) {
                console.log('Erro ao enviar como foto, tentando como vídeo:', error.message);
                // Se falhar como foto, tenta como vídeo
                try {
                  await ctx.replyWithVideo(
                      { url: mediaInfo.url },
                      {
                        caption: formattedCaption,
                        thumbnail: mediaInfo.thumbnail 
                      }
                    );
                } catch (videoError) {
                  console.log('Erro ao enviar como vídeo também, enviando sem legenda:', videoError.message);
                  // Último recurso: enviar sem legenda
                  await ctx.replyWithVideo(
                    { url: mediaInfo.url },
                    { thumbnail: mediaInfo.thumbnail }
                  );
                  // Enviar legenda separadamente
                  await ctx.reply(formattedCaption);
                }
            }
        } else {
            try {
                await ctx.replyWithVideo(
                    { url: mediaInfo.url },
                    {
                      caption: formattedCaption,
                      thumbnail: mediaInfo.thumbnail 
                    }
                  );
            } catch (error) {
                console.log('Erro ao enviar como vídeo, tentando como foto:', error.message);
                // Se falhar como vídeo, tenta como foto (fallback para Instagram/Threads)
                if(url.includes('instagram.com') || url.includes('threads.com')){
                    try {
                      await ctx.replyWithPhoto(
                          { url: mediaInfo.url },
                          {
                            caption: formattedCaption
                          }
                        );
                    } catch (photoError) {
                      console.log('Erro ao enviar como foto também, enviando sem legenda:', photoError.message);
                      // Último recurso: enviar sem legenda
                      await ctx.replyWithPhoto(
                        { url: mediaInfo.url }
                      );
                      // Enviar legenda separadamente
                      await ctx.reply(formattedCaption);
                    }
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
            caption: formattedCaption
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
              caption: formattedCaption
            }
          );
          await ctx.deleteMessage();
        } catch (documentError) {
          console.error('Erro ao enviar como documento, enviando sem legenda:', documentError.message);
          // Último recurso: sem legenda
          try {
            await ctx.replyWithDocument(
              { url: mediaInfo.mp3, filename: filename }
            );
            await ctx.reply(formattedCaption);
            await ctx.deleteMessage();
          } catch (finalError) {
            console.error('Erro final ao enviar documento:', finalError.message);
            throw finalError;
          }
        }
      }
      
    } catch (error) {
      console.error('Erro no handler MP3:', error);
      await ctx.answerCbQuery('❌ Erro ao enviar áudio', { show_alert: true });
      
      // Se chegou até aqui, significa que tanto áudio quanto documento falharam
      await ctx.reply(`❌ Não foi possível baixar o áudio.\nMotivo: ${error.message}\n\nTente novamente mais tarde ou use outro link.`);
    }
  });

  // Comando para listar grupos (apenas para o dono do bot)
  bot.command('grupos', async (ctx) => {
    try {
      // Verifica se é o dono do bot
      if (ctx.from.id !== parseInt(OWNER_ID)) {
        await ctx.reply('❌ Acesso negado. Este comando é restrito ao administrador do bot.');
        return;
      }
      
      await ctx.reply('🔍 Verificando grupos...');
      
      // Pega informações sobre o bot
      const botInfo = await bot.telegram.getMe();
      
      // Tenta obter updates recentes para identificar chats (com limite para evitar conflitos)
      const updates = await bot.telegram.getUpdates({ limit: 20, timeout: 5 });
      
      // Coleta IDs únicos de chats/grupos
      const chatIds = new Set();
      const chatMap = new Map();
      
      updates.forEach(update => {
        if (update.message) {
          const chat = update.message.chat;
          if (chat.type === 'group' || chat.type === 'supergroup') {
            const chatKey = chat.id.toString();
            if (!chatMap.has(chatKey)) {
              chatMap.set(chatKey, {
                id: chat.id,
                title: chat.title || 'Sem título',
                type: chat.type
              });
            }
          }
        }
      });
      
      if (chatMap.size === 0) {
        await ctx.reply('📊 Nenhum grupo encontrado nos updates recentes.\n💡 O bot precisa receber mensagens nos grupos para listá-los.');
        return;
      }
      
      let message = `📊 **GRUPOS ENCONTRADOS (${chatMap.size})**\n\n`;
      let groupCount = 0;
      
      for (const [chatId, chat] of chatMap) {
        groupCount++;
        message += `${groupCount}. 📍 **${chat.title}**\n`;
        message += `   ID: \`${chat.id}\`\n`;
        message += `   Tipo: ${chat.type === 'supergroup' ? 'Supergrupo' : 'Grupo'}\n`;
        
        // Tenta obter informações do chat
        try {
          const chatInfo = await bot.telegram.getChat(chat.id);
          if (chatInfo.members_count) {
            message += `   Membros: ${chatInfo.members_count}\n`;
          }
        } catch (error) {
          message += `   Membros: Não disponível\n`;
        }
        
        message += '\n';
      }
      
      message += `✅ **Total: ${groupCount} grupos ativos**`;
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('❌ Erro ao listar grupos:', error.message);
      await ctx.reply('❌ Erro ao verificar grupos. Certifique-se de que o bot tem as permissões necessárias.');
    }
  });
  
  
  // Graceful shutdown
  process.once('SIGINT', () => {
    console.log('🛑 Recebido SIGINT. Parando o bot...');
    bot.stop('SIGINT');
  });
  
  process.once('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM. Parando o bot...');
    bot.stop('SIGTERM');
  });
  
  // Tratamento de erro para conflitos
  bot.catch((err, ctx) => {
    console.error(`❌ Erro no bot para ${ctx.updateType}:`, err);
    if (err.code === 409) {
      console.log('⚠️ Conflito detectado. Verifique se há outra instância do bot rodando.');
      process.exit(1);
    }
  });
  
  try {
    bot.launch();
    console.log('Bot está rodando...');
    
    // Função para listar grupos após o bot iniciar (com delay maior para evitar conflitos)
    setTimeout(async () => {
      try {
        console.log('\n🔍 Verificando grupos...');
        
        // Pega informações sobre o bot
        const botInfo = await bot.telegram.getMe();
        console.log(`📱 Bot: @${botInfo.username} (${botInfo.first_name})`);
        
        // Aguarda um pouco mais antes de fazer getUpdates para evitar conflitos
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Tenta obter updates recentes para identificar chats
        const updates = await bot.telegram.getUpdates({ limit: 10 });
        
        // Coleta IDs únicos de chats/grupos
        const chatIds = new Set();
        
        updates.forEach(update => {
          if (update.message) {
            const chat = update.message.chat;
            if (chat.type === 'group' || chat.type === 'supergroup') {
              chatIds.add({
                id: chat.id,
                title: chat.title || 'Sem título',
                type: chat.type,
                memberCount: chat.all_members_are_administrators !== undefined ? 'N/A' : 'N/A'
              });
            }
          }
        });
        
        if (chatIds.size === 0) {
          console.log('📊 Nenhum grupo encontrado nos updates recentes.');
          console.log('💡 O bot precisa receber mensagens nos grupos para listá-los.');
        } else {
          console.log(`\n📊 GRUPOS ENCONTRADOS (${chatIds.size}):`);
          console.log('════════════════════════════════════════');
          
          let groupCount = 0;
          for (const chat of chatIds) {
            groupCount++;
            console.log(`${groupCount}. 📍 ${chat.title}`);
            console.log(`   ID: ${chat.id}`);
            console.log(`   Tipo: ${chat.type}`);
            
            // Tenta obter informações do chat
            try {
              const chatInfo = await bot.telegram.getChat(chat.id);
              if (chatInfo.members_count) {
                console.log(`   Membros: ${chatInfo.members_count}`);
              }
            } catch (error) {
              console.log(`   Membros: Não foi possível obter`);
            }
            
            console.log('   ────────────────────────');
          }
          
          console.log(`\n✅ Total: ${groupCount} grupos ativos\n`);
        }
        
      } catch (error) {
        if (error.code === 409) {
          console.error('❌ Conflito de instâncias detectado!');
          console.log('💡 Soluções:');
          console.log('   1. Pare todas as outras instâncias do bot');
          console.log('   2. Aguarde alguns minutos antes de reiniciar');
          console.log('   3. Certifique-se de usar apenas uma instância por vez');
        } else {
          console.error('❌ Erro ao verificar grupos:', error.message);
        }
        console.log('💡 Certifique-se de que o bot tem as permissões necessárias.\n');
      }
    }, 5000); // Aumentado para 5 segundos
    
  } catch (error) {
    if (error.code === 409) {
      console.error('❌ ERRO: Outra instância do bot já está rodando!');
      console.log('💡 Para resolver:');
      console.log('   1. Pare todas as instâncias do bot (PM2, terminal, etc.)');
      console.log('   2. Aguarde 2-3 minutos');
      console.log('   3. Inicie apenas uma instância');
      console.log('   4. Comando para parar PM2: pm2 stop all && pm2 delete all');
    } else {
      console.error('❌ Erro ao iniciar o bot:', error.message);
    }
    process.exit(1);
  }