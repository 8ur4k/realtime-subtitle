document.addEventListener('DOMContentLoaded', () => {
    const subtitleElement = document.getElementById('subtitle');
    const sourceLanguageSelect = document.getElementById('source-language');
    const targetLanguageSelect = document.getElementById('target-language');
    const backgroundToggleButton = document.getElementById('background-toggle');
    const resetSettingsButton = document.getElementById('reset-settings');
    const toggleRecognitionButton = document.getElementById('toggle-recognition');
    
    // Varsayılan değerler
    let sourceLanguage = localStorage.getItem('sourceLanguage') || 'tr'; // Varsayılan kaynak dil: Türkçe
    let targetLanguage = localStorage.getItem('targetLanguage') || 'tr'; // Varsayılan hedef dil: Türkçe
    let recognition = null; // Aktif tanıma nesnesini global olarak tut
    let isRecognitionActive = false; // Tanımanın aktif olup olmadığını izle
    let isBackgroundActive = false; // Arkaplan durumu
    let isRecognitionPaused = localStorage.getItem('recognitionPaused') === 'true'; // Tanıma durduruldu mu
    let displayTimeoutId = null; // Küresel olarak tanımlanmış zamanlayıcı
    let translationTimeout = null; // Küresel olarak tanımlanmış çeviri zamanlayıcısı
    let fadeTimeoutId = null; // Küresel olarak tanımlanmış solma zamanlayıcısı
    
    // Sayfa yüklendiğinde select elementlerinin değerlerini ayarla
    sourceLanguageSelect.value = sourceLanguage;
    targetLanguageSelect.value = targetLanguage;
    
    // Yerel depolamadan ayarları yükle
    loadSettingsFromLocalStorage();
    
    // Ayarları yerel depolamadan yükle
    function loadSettingsFromLocalStorage() {
        // Arkaplan durumunu yükle
        const savedBackgroundState = localStorage.getItem('subtitleBackground');
        if (savedBackgroundState === 'true') {
            isBackgroundActive = true;
            backgroundToggleButton.textContent = 'ARKAPLAN: AÇIK';
        }
        
        // Kaynak dil ayarını yükle
        const savedSourceLanguage = localStorage.getItem('sourceLanguage');
        if (savedSourceLanguage) {
            sourceLanguage = savedSourceLanguage;
            sourceLanguageSelect.value = savedSourceLanguage;
        }
        
        // Hedef dil ayarını yükle
        const savedTargetLanguage = localStorage.getItem('targetLanguage');
        if (savedTargetLanguage) {
            targetLanguage = savedTargetLanguage;
            targetLanguageSelect.value = savedTargetLanguage;
        }
        
        // Tanıma durumunu yükle
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
    
    // Tanıma durumunu değiştir
    function toggleRecognition() {
        isRecognitionPaused = !isRecognitionPaused;
        localStorage.setItem('recognitionPaused', isRecognitionPaused);
        
        updateRecognitionButton();
        
        if (isRecognitionPaused) {
            // Önce tüm zamanlayıcıları temizle
            clearTimeout(displayTimeoutId);
            clearTimeout(translationTimeout);
            clearTimeout(fadeTimeoutId);
            
            // Sonra tanımayı durdur
            stopRecognition();
            
            // Kullanıcıya bilgi ver
            subtitleElement.textContent = 'ALTYAZI DURDURULDU';
            
            // Arkaplan aktifse göster
            if (isBackgroundActive) {
                subtitleElement.classList.add('with-background');
            }
        } else {
            // Tanımayı yeniden başlat
            subtitleElement.textContent = '';
            subtitleElement.classList.remove('with-background');
            setTimeout(() => {
                setupSpeechRecognition();
            }, 300);
        }
    }
    
    // Tanımayı başlat/durdur butonuna tıklama olayı ekle
    toggleRecognitionButton.addEventListener('click', toggleRecognition);
    
    // Ayarları sıfırla fonksiyonu
    function resetSettings() {
        // LocalStorage'dan ayarları temizle
        localStorage.removeItem('sourceLanguage');
        localStorage.removeItem('targetLanguage');
        localStorage.removeItem('subtitleBackground');
        localStorage.removeItem('recognitionPaused');
        
        // Varsayılan değerlere dön
        sourceLanguage = 'tr';
        targetLanguage = 'tr';
        isBackgroundActive = false;
        isRecognitionPaused = false;
        
        // Arayüzü güncelle
        sourceLanguageSelect.value = 'tr';
        targetLanguageSelect.value = 'tr';
        backgroundToggleButton.textContent = 'ARKAPLAN: KAPALI';
        subtitleElement.classList.remove('with-background');
        updateRecognitionButton();
        
        console.log("Ayarlar sıfırlandı");
        
        // Tanımayı varsayılan dille yeniden başlat
        stopRecognition();
        setTimeout(() => {
            setupSpeechRecognition();
        }, 300);
    }
    
    // Sıfırlama butonuna olay dinleyicisi ekle
    resetSettingsButton.addEventListener('click', resetSettings);
    
    // Arkaplan toggle butonuna tıklama olayı ekle
    backgroundToggleButton.addEventListener('click', () => {
        isBackgroundActive = !isBackgroundActive;
        
        if (isBackgroundActive) {
            // Sadece altyazıda metin varsa arkaplanı göster
            if (subtitleElement.textContent.trim() !== '') {
                subtitleElement.classList.add('with-background');
            }
            // Active class'ı eklemiyoruz, sadece buton metnini değiştiriyoruz
            backgroundToggleButton.textContent = 'ARKAPLAN: AÇIK';
            localStorage.setItem('subtitleBackground', 'true');
        } else {
            subtitleElement.classList.remove('with-background');
            // Active class'ı kaldırmaya gerek yok çünkü hiç eklemedik
            backgroundToggleButton.textContent = 'ARKAPLAN: KAPALI';
            localStorage.setItem('subtitleBackground', 'false');
        }
    });
    
    // Dil seçimi değişikliklerini dinle
    sourceLanguageSelect.addEventListener('change', function() {
        sourceLanguage = this.value;
        localStorage.setItem('sourceLanguage', sourceLanguage);
        
        stopRecognition(); // Önce mevcut tanımayı durdur
        setTimeout(() => { // Kısa bir bekleme sonrası yeniden başlat
            setupSpeechRecognition();
        }, 300);
    });
    
    targetLanguageSelect.addEventListener('change', function() {
        targetLanguage = this.value;
        localStorage.setItem('targetLanguage', targetLanguage);
    });
    
    // Dil kodu eşleştiricisi (Web Speech API için)
    const languageCodeMap = {
        'af': 'af-ZA',   // Afrikaanca
        'am': 'am-ET',   // Amharca
        'ar': 'ar-SA',   // Arapça
        'az': 'az-AZ',   // Azerice
        'be': 'be-BY',   // Belarusça
        'bg': 'bg-BG',   // Bulgarca
        'bn': 'bn-IN',   // Bengalce
        'bs': 'bs-BA',   // Boşnakça
        'ca': 'ca-ES',   // Katalanca
        'ceb': 'ceb-PH', // Cebuano
        'co': 'co-FR',   // Korsikaca
        'cs': 'cs-CZ',   // Çekçe
        'cy': 'cy-GB',   // Galce
        'da': 'da-DK',   // Danca
        'de': 'de-DE',   // Almanca
        'dv': 'dv-MV',   // Divehi
        'el': 'el-GR',   // Yunanca
        'en': 'en-US',   // İngilizce
        'eo': 'eo',      // Esperanto
        'es': 'es-ES',   // İspanyolca
        'et': 'et-EE',   // Estonca
        'eu': 'eu-ES',   // Baskça
        'fa': 'fa-IR',   // Farsça
        'fi': 'fi-FI',   // Fince
        'fr': 'fr-FR',   // Fransızca
        'ga': 'ga-IE',   // İrlandaca
        'gd': 'gd-GB',   // İskoç Gaelcesi
        'gl': 'gl-ES',   // Galiçyaca
        'gu': 'gu-IN',   // Gujarati
        'ha': 'ha-NG',   // Hausa
        'haw': 'haw-US', // Hawaii Dili
        'he': 'he-IL',   // İbranice
        'hi': 'hi-IN',   // Hintçe
        'hmn': 'hmn',    // Hmong
        'hr': 'hr-HR',   // Hırvatça
        'hu': 'hu-HU',   // Macarca
        'hy': 'hy-AM',   // Ermenice
        'id': 'id-ID',   // Endonezce
        'ig': 'ig-NG',   // İbo Dili
        'is': 'is-IS',   // İzlandaca
        'it': 'it-IT',   // İtalyanca
        'ja': 'ja-JP',   // Japonca
        'jw': 'jw-ID',   // Cava Dili
        'ka': 'ka-GE',   // Gürcüce
        'kg': 'kg-CG',   // Kikongo
        'kk': 'kk-KZ',   // Kazakça
        'km': 'km-KH',   // Kamboçyaca
        'kn': 'kn-IN',   // Kannada
        'ko': 'ko-KR',   // Korece
        'ku': 'ku-TR',   // Kürtçe
        'ky': 'ky-KG',   // Kırgızca
        'la': 'la',      // Latince
        'lb': 'lb-LU',   // Lüksemburgca
        'lo': 'lo-LA',   // Laoca
        'lt': 'lt-LT',   // Litvanca
        'lv': 'lv-LV',   // Letonca
        'mg': 'mg-MG',   // Malgaşça
        'mi': 'mi-NZ',   // Maori
        'mk': 'mk-MK',   // Makedonca
        'ml': 'ml-IN',   // Malayalam
        'mn': 'mn-MN',   // Moğolca
        'mr': 'mr-IN',   // Marathi
        'ms': 'ms-MY',   // Malayca
        'mt': 'mt-MT',   // Maltaca
        'my': 'my-MM',   // Birmanca
        'ne': 'ne-NP',   // Nepalce
        'nl': 'nl-NL',   // Hollandaca
        'no': 'no-NO',   // Norveççe
        'ny': 'ny-MW',   // Chichewa
        'or': 'or-IN',   // Odia
        'pa': 'pa-IN',   // Pencapça
        'pl': 'pl-PL',   // Lehçe
        'ps': 'ps-AF',   // Peştuca
        'pt': 'pt-PT',   // Portekizce
        'ro': 'ro-RO',   // Romence
        'ru': 'ru-RU',   // Rusça
        'rw': 'rw-RW',   // Kinyarwanda
        'sd': 'sd-PK',   // Sindhi
        'si': 'si-LK',   // Sinhala
        'sk': 'sk-SK',   // Slovakça
        'sl': 'sl-SI',   // Slovence
        'sm': 'sm-WS',   // Samoa Dili
        'sn': 'sn-ZW',   // Shona
        'so': 'so-SO',   // Somalice
        'sq': 'sq-AL',   // Arnavutça
        'sr': 'sr-RS',   // Sırpça
        'st': 'st-LS',   // Sesotho
        'su': 'su-ID',   // Sundaca
        'sv': 'sv-SE',   // İsveççe
        'sw': 'sw-KE',   // Svahili
        'ta': 'ta-IN',   // Tamilce
        'te': 'te-IN',   // Telugu
        'tg': 'tg-TJ',   // Tacikçe
        'th': 'th-TH',   // Tayca
        'tk': 'tk-TM',   // Türkmence
        'tl': 'fil-PH',  // Filipince (Tagalog)
        'tr': 'tr-TR',   // Türkçe
        'tt': 'tt-RU',   // Tatarca
        'ug': 'ug-CN',   // Uygurca
        'uk': 'uk-UA',   // Ukraynaca
        'ur': 'ur-PK',   // Urduca
        'uz': 'uz-UZ',   // Özbekçe
        'vi': 'vi-VN',   // Vietnamca
        'xh': 'xh-ZA',   // Zosa
        'yi': 'yi',      // Yidiş
        'zh': 'zh-CN',   // Çince (Mandarin)
        'zu': 'zu-ZA'    // Zulu
    };
    
    // Tanımayı tamamen durdurma fonksiyonu
    function stopRecognition() {
        if (recognition) {
            try {
                // Event listener'ları temizle
                recognition.onresult = null;
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onstart = null;
                
                // Tanımayı sonlandır
                recognition.abort();
                console.log("Tanıma tamamen durduruldu");
            } catch (e) {
                console.warn("Tanıma durdurulurken hata:", e);
            } finally {
                recognition = null;
                isRecognitionActive = false;
            }
        }
    }
    
    // Sayfa kapanırken temizlik yap
    window.addEventListener('beforeunload', stopRecognition);
    
    // Google Translate API için ücretsiz yöntem
    async function translateText(text, sourceLang, targetLang) {
        // Kaynak ve hedef dil aynıysa çevirme
        if (!text || sourceLang === targetLang) {
            return text;
        }
        
        try {
            console.log(`Çeviriliyor: ${sourceLang} -> ${targetLang}`, text);
            // Google Translate'in ücretsiz API'sini kullanma
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            // API yanıtından çeviriyi çıkar
            let translatedText = '';
            if (data && data[0]) {
                data[0].forEach(item => {
                    if (item[0]) {
                        translatedText += item[0];
                    }
                });
            }
            
            console.log("Çeviri sonucu:", translatedText);
            return translatedText;
        } catch (error) {
            console.error('Çeviri hatası:', error);
            return text; // Hata durumunda orijinal metni döndür
        }
    }
    
    // Konuşma tanıma
    function setupSpeechRecognition() {
        // Eğer tanıma duraklatılmışsa, başlatma
        if (isRecognitionPaused) {
            console.log("Tanıma duraklatılmış durumda, başlatılmıyor");
            return;
        }
        
        // Web Speech API tarayıcı desteğini kontrol et
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            subtitleElement.textContent = 'Tarayıcınız konuşma tanımayı desteklemiyor.';
            return;
        }
        
        // Önce eski tanıma nesnesi varsa temizle
        stopRecognition();
        
        // SpeechRecognition nesnesini oluştur
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // Ayarlar - seçilen dile göre tanıma
        const recognitionLang = languageCodeMap[sourceLanguage] || 'tr-TR';
        recognition.lang = recognitionLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        console.log(`Konuşma tanıma dili ayarlandı: ${recognitionLang}`);
        
        let currentText = '';
        let lastFinalText = '';
        
        // Konuşma sonuçlarını dinle
        recognition.onresult = async (event) => {
            // Eğer duraklatıldıysa, sonuçları işleme
            if (isRecognitionPaused) {
                return;
            }
            
            // Geçici sonuç (henüz kesinleşmemiş kelimeler)
            let interimTranscript = '';
            // Kesinleşmiş sonuç
            let finalTranscript = '';
            
            // Tüm sonuçları işle
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.trim();
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                    lastFinalText = finalTranscript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Ekranda gösterilecek metni hazırla
            currentText = lastFinalText + interimTranscript;
            
            // Metni çevir ve ekrana akıcı bir şekilde yansıt
            if (currentText.trim() !== '') {
                // Önceki çeviri talebini iptal et
                clearTimeout(translationTimeout);
                
                // Anlık çeviri talebi oluştur (her yeni kelimede tüm metni çevir)
                translationTimeout = setTimeout(async () => {
                    // Duraklatıldıysa çevirme
                    if (isRecognitionPaused) {
                        return;
                    }
                    
                    // Kaynak ve hedef dil aynıysa doğrudan metni göster
                    if (sourceLanguage === targetLanguage) {
                        updateSubtitle(currentText);
                    } else {
                        // Farklı diller ise çeviri yap
                        const translatedText = await translateText(currentText, sourceLanguage, targetLanguage);
                        updateSubtitle(translatedText);
                    }
                }, 200);
            }
            
            // Konuşma durduğunda bir süre sonra metni temizle
            if (finalTranscript && finalTranscript !== '') {
                clearTimeout(displayTimeoutId);
                displayTimeoutId = setTimeout(() => {
                    // Duraklatıldıysa temizleme
                    if (isRecognitionPaused) {
                        return;
                    }
                    
                    fadeOutSubtitle();
                    lastFinalText = '';
                    currentText = '';
                }, 4000);
            }
        };
        
        // Altyazıyı güncelle
        function updateSubtitle(text) {
            if (text.trim() !== '') {
                // Önceki zamanlayıcıları temizle
                clearTimeout(fadeTimeoutId);
                
                // Önceki animasyonları durdur ve altyazıyı görünür yap
                subtitleElement.style.transition = '';
                subtitleElement.style.opacity = 1;
                subtitleElement.textContent = text.toUpperCase();
                
                // Arkaplan aktifse göster
                if (isBackgroundActive) {
                    subtitleElement.classList.add('with-background');
                }
            } else {
                // Yazı boşsa arkaplanı kaldır
                subtitleElement.classList.remove('with-background');
                subtitleElement.textContent = '';
            }
        }
        
        // Altyazıyı yumuşak bir şekilde kaybet
        function fadeOutSubtitle() {
            // Önceki zamanlayıcıları temizle
            clearTimeout(fadeTimeoutId);
            
            subtitleElement.style.transition = 'opacity 0.5s ease';
            subtitleElement.style.opacity = 0;
            
            fadeTimeoutId = setTimeout(() => {
                subtitleElement.textContent = '';
                subtitleElement.style.transition = '';
                subtitleElement.style.opacity = 1;
                // Yazı silindiğinde arkaplanı da kaldır
                subtitleElement.classList.remove('with-background');
            }, 500);
        }
        
        // Tanıma başladığında
        recognition.onstart = () => {
            isRecognitionActive = true;
            console.log("Konuşma tanıma başladı");
        };
        
        // Hata durumunda
        recognition.onerror = (event) => {
            console.error('Konuşma tanıma hatası:', event.error);
            
            if (event.error === 'not-allowed') {
                // Mikrofon izni hatası - kullanıcıya bildir
                subtitleElement.textContent = 'LÜTFEN MİKROFON İZNİ VERİN';
                return;
            }
            
            // Aborted hatası dil değişiminde normal, yeniden başlatılacak
            if (event.error === 'aborted') {
                isRecognitionActive = false;
                setTimeout(() => {
                    startRecognition();
                }, 500);
                return;
            }
            
            // Diğer hatalar için yeniden başlat
            if (event.error !== 'no-speech') {
                isRecognitionActive = false;
                setTimeout(() => {
                    startRecognition();
                }, 1000);
            }
        };
        
        // Tanıma bittiğinde yeniden başlat
        recognition.onend = () => {
            console.log("Konuşma tanıma sona erdi");
            isRecognitionActive = false;
            
            // Duraklatılmışsa yeniden başlatma
            if (!isRecognitionPaused) {
                // Eğer sistemin kendisi bitirdiyse, yeniden başlat
                setTimeout(() => {
                    startRecognition();
                }, 300);
            } else {
                console.log("Tanıma duraklatılmış, yeniden başlatılmıyor");
            }
        };
        
        // Tanımayı başlatma fonksiyonu
        function startRecognition() {
            // Eğer tanıma duraklatılmışsa, başlatma
            if (isRecognitionPaused) {
                console.log("Tanıma duraklatılmış, başlatılmıyor");
                return;
            }
            
            if (!isRecognitionActive) {
                try {
                    recognition.start();
                    console.log("Tanıma başlatılıyor...");
                } catch (e) {
                    console.error('Tanıma başlatılamadı:', e);
                    // Eğer zaten çalışıyorsa, durumu düzelt
                    if (e.name === 'InvalidStateError') {
                        isRecognitionActive = true;
                    } else {
                        // Diğer hatalar için biraz bekle ve tekrar dene
                        setTimeout(() => {
                            if (!isRecognitionPaused) {
                                startRecognition();
                            }
                        }, 1000);
                    }
                }
            } else {
                console.log("Tanıma zaten aktif, yeniden başlatılmıyor");
            }
        }
        
        // Tanımayı başlat
        startRecognition();
    }
    
    // Başlangıçta tanıma butonunu doğru duruma getir
    updateRecognitionButton();
    
    // Eğer tanıma duraklatılmamışsa, konuşma tanımayı başlat
    if (!isRecognitionPaused) {
        setupSpeechRecognition();
    } else {
        // Duraklatılmışsa, kullanıcıya bildir
        subtitleElement.textContent = 'ALTYAZI DURDURULDU';
        if (isBackgroundActive) {
            subtitleElement.classList.add('with-background');
        }
    }
}); 