document.addEventListener('DOMContentLoaded', () => {
    const subtitleElement = document.getElementById('subtitle');
    const sourceLanguageSelect = document.getElementById('source-language');
    const targetLanguageSelect = document.getElementById('target-language');
    const backgroundToggleButton = document.getElementById('background-toggle');
    const resetSettingsButton = document.getElementById('reset-settings');
    const toggleRecognitionButton = document.getElementById('toggle-recognition');
    const wordTimeDurationButton = document.getElementById('word-time-duration');
    
    // Varsayılan değerler
    let sourceLanguage = localStorage.getItem('sourceLanguage') || 'tr';
    let targetLanguage = localStorage.getItem('targetLanguage') || 'tr';
    let recognition = null;
    let isRecognitionActive = false;
    let isBackgroundActive = false;
    let isRecognitionPaused = localStorage.getItem('recognitionPaused') === 'true';
    let translationTimeout = null;
    let wordCounter = 0;
    let activeWords = new Map(); // Aktif kelimeleri ve zamanlayıcılarını tutacak
    let lastProcessedText = ''; // Son işlenen metni sakla
    let processingQueue = []; // İşlem kuyruğu
    let isProcessing = false; // İşlem durumu kontrolü
    
    // Maksimum kelime sayısı (2 satır için yaklaşık)
    const MAX_WORDS_ON_SCREEN = 20;
    
    // Her kelime için kalma süresi
    let WORD_DISPLAY_DURATION = parseInt(localStorage.getItem('wordDisplayDuration')) || 5000;
    
    // Çeviri önbelleği (performans için)
    const translationCache = new Map();
    const CACHE_SIZE_LIMIT = 100;
    
    // Kelime süre butonunu güncelle
    function updateWordTimeDurationButton() {
        if (wordTimeDurationButton) {
            const durationInSeconds = WORD_DISPLAY_DURATION / 1000;
            wordTimeDurationButton.textContent = `KELİME SÜRESİ: ${durationInSeconds} SN`;
        }
    }
    
    // Kelime süre butonu event listener
    if (wordTimeDurationButton) {
        updateWordTimeDurationButton();
        
        wordTimeDurationButton.addEventListener('click', () => {
            const durations = [3000, 5000, 7000, 10000];
            const currentIndex = durations.indexOf(WORD_DISPLAY_DURATION);
            const nextIndex = (currentIndex + 1) % durations.length;
            WORD_DISPLAY_DURATION = durations[nextIndex];
            
            localStorage.setItem('wordDisplayDuration', WORD_DISPLAY_DURATION);
            updateWordTimeDurationButton();
        });
    }
    
    // Başlangıç ayarları
    sourceLanguageSelect.value = sourceLanguage;
    targetLanguageSelect.value = targetLanguage;
    loadSettingsFromLocalStorage();
    
    // Ayarları yükle
    function loadSettingsFromLocalStorage() {
        const savedBackgroundState = localStorage.getItem('subtitleBackground');
        if (savedBackgroundState === 'true') {
            isBackgroundActive = true;
            backgroundToggleButton.textContent = 'ARKAPLAN: AÇIK';
        }
        
        const savedSourceLanguage = localStorage.getItem('sourceLanguage');
        if (savedSourceLanguage) {
            sourceLanguage = savedSourceLanguage;
            sourceLanguageSelect.value = savedSourceLanguage;
        }
        
        const savedTargetLanguage = localStorage.getItem('targetLanguage');
        if (savedTargetLanguage) {
            targetLanguage = savedTargetLanguage;
            targetLanguageSelect.value = savedTargetLanguage;
        }
        
        isRecognitionPaused = localStorage.getItem('recognitionPaused') === 'true';
        updateRecognitionButton();
    }
    
    // Tanıma butonunu güncelle
    function updateRecognitionButton() {
        if (isRecognitionPaused) {
            toggleRecognitionButton.textContent = 'BAŞLAT';
            toggleRecognitionButton.classList.remove('active');
            toggleRecognitionButton.classList.add('inactive');
        } else {
            toggleRecognitionButton.textContent = 'DURDUR';
            toggleRecognitionButton.classList.add('active');
            toggleRecognitionButton.classList.remove('inactive');
        }
    }
    
    // Tüm zamanlayıcıları ve durumu temizle
    function clearAllTimersAndState() {
        // Çeviri zamanlayıcısını temizle
        if (translationTimeout) {
            clearTimeout(translationTimeout);
            translationTimeout = null;
        }
        
        // Tüm aktif kelime zamanlayıcılarını temizle
        activeWords.forEach((wordData, wordId) => {
            if (wordData.timer) {
                clearTimeout(wordData.timer);
            }
            const element = document.getElementById(wordId);
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        activeWords.clear();
        processingQueue = [];
        isProcessing = false;
        lastProcessedText = '';
        
        // Altyazı elementini temizle
        subtitleElement.textContent = '';
        subtitleElement.classList.remove('with-background');
        
        console.log("Tüm zamanlayıcılar ve durum temizlendi");
    }
    
    // Tanıma durumunu değiştir
    function toggleRecognition() {
        isRecognitionPaused = !isRecognitionPaused;
        localStorage.setItem('recognitionPaused', isRecognitionPaused);
        updateRecognitionButton();
        
        if (isRecognitionPaused) {
            clearAllTimersAndState();
            stopRecognition();
            subtitleElement.textContent = 'ALTYAZI DURDURULDU';
            
            if (isBackgroundActive) {
                subtitleElement.classList.add('with-background');
            }
        } else {
            subtitleElement.textContent = '';
            subtitleElement.classList.remove('with-background');
            setTimeout(() => {
                setupSpeechRecognition();
            }, 300);
        }
    }
    
    // Event listeners
    toggleRecognitionButton.addEventListener('click', toggleRecognition);
    
    // Ayarları sıfırla
    function resetSettings() {
        localStorage.removeItem('sourceLanguage');
        localStorage.removeItem('targetLanguage');
        localStorage.removeItem('subtitleBackground');
        localStorage.removeItem('recognitionPaused');
        localStorage.removeItem('wordDisplayDuration');
        
        sourceLanguage = 'tr';
        targetLanguage = 'tr';
        isBackgroundActive = false;
        isRecognitionPaused = false;
        WORD_DISPLAY_DURATION = 5000;
        
        sourceLanguageSelect.value = 'tr';
        targetLanguageSelect.value = 'tr';
        backgroundToggleButton.textContent = 'ARKAPLAN: KAPALI';
        subtitleElement.classList.remove('with-background');
        updateRecognitionButton();
        
        if (wordTimeDurationButton) {
            updateWordTimeDurationButton();
        }
        
        // Önbelleği temizle
        translationCache.clear();
        
        stopRecognition();
        setTimeout(() => {
            setupSpeechRecognition();
        }, 300);
    }
    
    resetSettingsButton.addEventListener('click', resetSettings);
    
    // Arkaplan toggle
    backgroundToggleButton.addEventListener('click', () => {
        isBackgroundActive = !isBackgroundActive;
        
        if (isBackgroundActive) {
            if (subtitleElement.textContent.trim() !== '') {
                subtitleElement.classList.add('with-background');
            }
            backgroundToggleButton.textContent = 'ARKAPLAN: AÇIK';
            localStorage.setItem('subtitleBackground', 'true');
        } else {
            subtitleElement.classList.remove('with-background');
            backgroundToggleButton.textContent = 'ARKAPLAN: KAPALI';
            localStorage.setItem('subtitleBackground', 'false');
        }
    });
    
    // Dil seçim event listeners
    sourceLanguageSelect.addEventListener('change', function() {
        sourceLanguage = this.value;
        localStorage.setItem('sourceLanguage', sourceLanguage);
        translationCache.clear(); // Dil değişince önbelleği temizle
        
        stopRecognition();
        setTimeout(() => {
            setupSpeechRecognition();
        }, 300);
    });
    
    targetLanguageSelect.addEventListener('change', function() {
        targetLanguage = this.value;
        localStorage.setItem('targetLanguage', targetLanguage);
        translationCache.clear(); // Dil değişince önbelleği temizle
    });
    
    // Dil kodu eşleştirmesi
    const languageCodeMap = {
        'af': 'af-ZA', 'am': 'am-ET', 'ar': 'ar-SA', 'az': 'az-AZ', 'be': 'be-BY',
        'bg': 'bg-BG', 'bn': 'bn-IN', 'bs': 'bs-BA', 'ca': 'ca-ES', 'ceb': 'ceb-PH',
        'co': 'co-FR', 'cs': 'cs-CZ', 'cy': 'cy-GB', 'da': 'da-DK', 'de': 'de-DE',
        'dv': 'dv-MV', 'el': 'el-GR', 'en': 'en-US', 'eo': 'eo', 'es': 'es-ES',
        'et': 'et-EE', 'eu': 'eu-ES', 'fa': 'fa-IR', 'fi': 'fi-FI', 'fr': 'fr-FR',
        'ga': 'ga-IE', 'gd': 'gd-GB', 'gl': 'gl-ES', 'gu': 'gu-IN', 'ha': 'ha-NG',
        'haw': 'haw-US', 'he': 'he-IL', 'hi': 'hi-IN', 'hmn': 'hmn', 'hr': 'hr-HR',
        'hu': 'hu-HU', 'hy': 'hy-AM', 'id': 'id-ID', 'ig': 'ig-NG', 'is': 'is-IS',
        'it': 'it-IT', 'ja': 'ja-JP', 'jw': 'jw-ID', 'ka': 'ka-GE', 'kg': 'kg-CG',
        'kk': 'kk-KZ', 'km': 'km-KH', 'kn': 'kn-IN', 'ko': 'ko-KR', 'ku': 'ku-TR',
        'ky': 'ky-KG', 'la': 'la', 'lb': 'lb-LU', 'lo': 'lo-LA', 'lt': 'lt-LT',
        'lv': 'lv-LV', 'mg': 'mg-MG', 'mi': 'mi-NZ', 'mk': 'mk-MK', 'ml': 'ml-IN',
        'mn': 'mn-MN', 'mr': 'mr-IN', 'ms': 'ms-MY', 'mt': 'mt-MT', 'my': 'my-MM',
        'ne': 'ne-NP', 'nl': 'nl-NL', 'no': 'no-NO', 'ny': 'ny-MW', 'or': 'or-IN',
        'pa': 'pa-IN', 'pl': 'pl-PL', 'ps': 'ps-AF', 'pt': 'pt-PT', 'ro': 'ro-RO',
        'ru': 'ru-RU', 'rw': 'rw-RW', 'sd': 'sd-PK', 'si': 'si-LK', 'sk': 'sk-SK',
        'sl': 'sl-SI', 'sm': 'sm-WS', 'sn': 'sn-ZW', 'so': 'so-SO', 'sq': 'sq-AL',
        'sr': 'sr-RS', 'st': 'st-LS', 'su': 'su-ID', 'sv': 'sv-SE', 'sw': 'sw-KE',
        'ta': 'ta-IN', 'te': 'te-IN', 'tg': 'tg-TJ', 'th': 'th-TH', 'tk': 'tk-TM',
        'tl': 'fil-PH', 'tr': 'tr-TR', 'tt': 'tt-RU', 'ug': 'ug-CN', 'uk': 'uk-UA',
        'ur': 'ur-PK', 'uz': 'uz-UZ', 'vi': 'vi-VN', 'xh': 'xh-ZA', 'yi': 'yi',
        'zh': 'zh-CN', 'zu': 'zu-ZA'
    };
    
    // Tanımayı durdur
    function stopRecognition() {
        if (recognition) {
            try {
                recognition.onresult = null;
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onstart = null;
                recognition.abort();
            } catch (e) {
                console.warn("Tanıma durdurulurken hata:", e);
            } finally {
                recognition = null;
                isRecognitionActive = false;
            }
        }
    }
    
    // Sayfa kapanırken temizlik
    window.addEventListener('beforeunload', () => {
        clearAllTimersAndState();
        stopRecognition();
    });
    
    // Önbellekli çeviri fonksiyonu
    async function translateText(text, sourceLang, targetLang) {
        if (!text || sourceLang === targetLang) {
            return text;
        }
        
        // Önbellekte kontrol et
        const cacheKey = `${sourceLang}-${targetLang}-${text}`;
        if (translationCache.has(cacheKey)) {
            return translationCache.get(cacheKey);
        }
        
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            let translatedText = '';
            if (data && data[0]) {
                data[0].forEach(item => {
                    if (item[0]) {
                        translatedText += item[0];
                    }
                });
            }
            
            // Önbelleğe ekle (boyut sınırı ile)
            if (translationCache.size >= CACHE_SIZE_LIMIT) {
                const firstKey = translationCache.keys().next().value;
                translationCache.delete(firstKey);
            }
            translationCache.set(cacheKey, translatedText);
            
            return translatedText;
        } catch (error) {
            console.error('Çeviri hatası:', error);
            return text;
        }
    }
    
    // Metin benzerlik kontrolü (gereksiz işlemleri önlemek için)
    function isTextSimilar(text1, text2, threshold = 0.8) {
        if (!text1 || !text2) return false;
        
        const words1 = text1.toLowerCase().split(' ');
        const words2 = text2.toLowerCase().split(' ');
        
        const commonWords = words1.filter(word => words2.includes(word));
        const similarity = commonWords.length / Math.max(words1.length, words2.length);
        
        return similarity >= threshold;
    }
    
    // Kelime sayısını kontrol et ve gerekirse eski kelimeleri kaldır
    function manageWordLimit() {
        if (activeWords.size <= MAX_WORDS_ON_SCREEN) return;
        
        // En eski kelimeleri bul ve kaldır
        const sortedWords = Array.from(activeWords.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const wordsToRemove = sortedWords.slice(0, activeWords.size - MAX_WORDS_ON_SCREEN);
        
        wordsToRemove.forEach(([wordId, wordData]) => {
            removeWord(wordId, false); // Animasyon olmadan hızlı kaldır
        });
    }
    
    // Kelimeyi kaldır
    function removeWord(wordId, withAnimation = true) {
        const wordData = activeWords.get(wordId);
        if (!wordData) return;
        
        // Zamanlayıcıyı temizle
        if (wordData.timer) {
            clearTimeout(wordData.timer);
        }
        
        const element = document.getElementById(wordId);
        if (!element) {
            activeWords.delete(wordId);
            return;
        }
        
        if (withAnimation) {
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = 0;
            
            setTimeout(() => {
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                activeWords.delete(wordId);
                
                // Eğer altyazı boşsa arkaplanı kaldır
                if (activeWords.size === 0) {
                    subtitleElement.classList.remove('with-background');
                }
            }, 300);
        } else {
            // Animasyon olmadan hızlı kaldır
            element.parentNode.removeChild(element);
            activeWords.delete(wordId);
        }
    }
    
    // Kelimeyi zamanlayıcıyla ekle
    function addWordWithTimer(word) {
        if (!word || word.trim() === '') return;
        
        // Kelime sayısı kontrolü
        manageWordLimit();
        
        const wordId = `word-${wordCounter++}`;
        const wordSpan = document.createElement('span');
        wordSpan.textContent = word + ' ';
        wordSpan.id = wordId;
        wordSpan.classList.add('subtitle-word');
        subtitleElement.appendChild(wordSpan);
        
        // Arkaplan kontrolü
        if (isBackgroundActive && activeWords.size === 0) {
            subtitleElement.classList.add('with-background');
        }
        
        // Zamanlayıcı oluştur
        const timer = setTimeout(() => {
            removeWord(wordId, true);
        }, WORD_DISPLAY_DURATION);
        
        // Aktif kelimeler listesine ekle
        activeWords.set(wordId, {
            timer: timer,
            timestamp: Date.now(),
            word: word
        });
    }
    
    // Asenkron işlem kuyruğu
    async function processQueue() {
        if (isProcessing || processingQueue.length === 0) return;
        
        isProcessing = true;
        
        while (processingQueue.length > 0) {
            const { text, isInterim } = processingQueue.shift();
            
            // Benzer metin kontrolü
            if (isTextSimilar(text, lastProcessedText)) {
                continue;
            }
            
            try {
                let processedText = text;
                
                // Çeviri gerekiyorsa yap
                if (sourceLanguage !== targetLanguage) {
                    processedText = await translateText(text, sourceLanguage, targetLanguage);
                }
                
                // Kelimelere ayır ve işle
                const words = processedText.split(' ')
                    .filter(word => word.trim() !== '')
                    .map(word => word.toUpperCase().replace(/[^\p{L}\p{N}\s]/gu, ''))
                    .filter(word => word);
                
                // Kelimeleri ekle
                words.forEach(word => addWordWithTimer(word));
                
                lastProcessedText = text;
                
            } catch (error) {
                console.error('İşlem hatası:', error);
            }
            
            // Kısa bir bekleme (UI donmaması için)
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        isProcessing = false;
    }
    
    // Konuşma tanıma kurulumu
    function setupSpeechRecognition() {
        if (isRecognitionPaused) {
            console.log("Tanıma duraklatılmış");
            return;
        }
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            subtitleElement.textContent = 'Tarayıcınız konuşma tanımayı desteklemiyor.';
            return;
        }
        
        stopRecognition();
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        const recognitionLang = languageCodeMap[sourceLanguage] || 'tr-TR';
        recognition.lang = recognitionLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        console.log(`Tanıma dili: ${recognitionLang}`);
        
        recognition.onresult = async (event) => {
            if (isRecognitionPaused) return;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.trim();
                if (!transcript) continue;
                
                // Kuyruğa ekle
                processingQueue.push({
                    text: transcript,
                    isInterim: !event.results[i].isFinal
                });
                
                // Kuyruk işlemini başlat
                processQueue();
            }
        };
        
        recognition.onstart = () => {
            isRecognitionActive = true;
            console.log("Tanıma başladı");
        };
        
        recognition.onerror = (event) => {
            console.error('Tanıma hatası:', event.error);
            
            if (event.error === 'not-allowed') {
                subtitleElement.textContent = 'LÜTFEN MİKROFON İZNİ VERİN';
                return;
            }
            
            if (event.error === 'aborted') {
                isRecognitionActive = false;
                setTimeout(startRecognition, 500);
                return;
            }
            
            if (event.error !== 'no-speech') {
                isRecognitionActive = false;
                setTimeout(startRecognition, 1000);
            }
        };
        
        recognition.onend = () => {
            console.log("Tanıma sona erdi");
            isRecognitionActive = false;
            
            if (!isRecognitionPaused) {
                setTimeout(startRecognition, 300);
            }
        };
        
        function startRecognition() {
            if (isRecognitionPaused || isRecognitionActive) return;
            
            try {
                recognition.start();
                console.log("Tanıma başlatılıyor...");
            } catch (e) {
                console.error('Tanıma başlatılamadı:', e);
                if (e.name === 'InvalidStateError') {
                    isRecognitionActive = true;
                } else {
                    setTimeout(startRecognition, 1000);
                }
            }
        }
        
        startRecognition();
    }
    
    // Başlangıç
    updateRecognitionButton();
    
    if (!isRecognitionPaused) {
        setupSpeechRecognition();
    } else {
        subtitleElement.textContent = 'ALTYAZI DURDURULDU';
        if (isBackgroundActive) {
            subtitleElement.classList.add('with-background');
        }
    }
});