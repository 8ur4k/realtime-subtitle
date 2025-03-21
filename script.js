document.addEventListener('DOMContentLoaded', () => {
    const subtitleElement = document.getElementById('subtitle');
    const sourceLanguageSelect = document.getElementById('source-language');
    const targetLanguageSelect = document.getElementById('target-language');
    
    let sourceLanguage = 'tr'; // Varsayılan kaynak dil: Türkçe
    let targetLanguage = 'tr'; // Varsayılan hedef dil: Türkçe
    let recognition = null; // Aktif tanıma nesnesini global olarak tut
    let isRecognitionActive = false; // Tanımanın aktif olup olmadığını izle
    
    // Dil seçimi değişikliklerini dinle
    sourceLanguageSelect.addEventListener('change', function() {
        sourceLanguage = this.value;
        stopRecognition(); // Önce mevcut tanımayı durdur
        setTimeout(() => { // Kısa bir bekleme sonrası yeniden başlat
            setupSpeechRecognition();
        }, 300);
    });
    
    targetLanguageSelect.addEventListener('change', function() {
        targetLanguage = this.value;
    });
    
    // Dil kodu eşleştiricisi (Web Speech API için)
    const languageCodeMap = {
        'tr': 'tr-TR',
        'en': 'en-US',
        'de': 'de-DE',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'it': 'it-IT',
        'ru': 'ru-RU',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ar': 'ar-SA',
        'no': 'no-NO',
        'hi': 'hi-IN'
    };
    
    // Tanımayı tamamen durdurma fonksiyonu
    function stopRecognition() {
        if (recognition && isRecognitionActive) {
            try {
                recognition.stop();
                console.log("Tanıma durduruldu");
            } catch (e) {
                console.warn("Tanıma durdurulurken hata:", e);
            }
            isRecognitionActive = false;
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
        let displayTimeoutId = null;
        let translationTimeout = null;
        
        // Konuşma sonuçlarını dinle
        recognition.onresult = async (event) => {
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
                    // Kaynak ve hedef dil aynıysa doğrudan metni göster
                    if (sourceLanguage === targetLanguage) {
                        updateSubtitle(currentText);
                    } else {
                        // Farklı diller ise çeviri yap
                        const translatedText = await translateText(currentText, sourceLanguage, targetLanguage);
                        updateSubtitle(translatedText);
                    }
                }, 200); // Çok sık çeviri istekleri yapılmasını önlemek için küçük bir gecikme
            }
            
            // Konuşma durduğunda bir süre sonra metni temizle
            if (finalTranscript && finalTranscript !== '') {
                clearTimeout(displayTimeoutId);
                displayTimeoutId = setTimeout(() => {
                    fadeOutSubtitle();
                    lastFinalText = '';
                    currentText = '';
                }, 4000);
            }
        };
        
        // Altyazıyı güncelle
        function updateSubtitle(text) {
            if (text.trim() !== '') {
                // Önceki animasyonları durdur ve altyazıyı görünür yap
                subtitleElement.style.opacity = 1;
                subtitleElement.textContent = text.toUpperCase();
            }
        }
        
        // Altyazıyı yumuşak bir şekilde kaybet
        function fadeOutSubtitle() {
            subtitleElement.style.transition = 'opacity 0.5s ease';
            subtitleElement.style.opacity = 0;
            
            setTimeout(() => {
                subtitleElement.textContent = '';
                subtitleElement.style.transition = '';
                subtitleElement.style.opacity = 1;
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
            
            // Eğer sistemin kendisi bitirdiyse, yeniden başlat
            setTimeout(() => {
                startRecognition();
            }, 300);
        };
        
        // Tanımayı başlatma fonksiyonu
        function startRecognition() {
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
                            startRecognition();
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
    
    // Konuşma tanımayı başlat
    setupSpeechRecognition();
}); 