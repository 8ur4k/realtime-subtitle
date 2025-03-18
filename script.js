document.addEventListener('DOMContentLoaded', () => {
    const subtitleElement = document.getElementById('subtitle');
    const targetLanguageSelect = document.getElementById('target-language');
    
    let selectedLanguage = 'tr'; // Varsayılan dil: Türkçe
    
    // Dil seçimi değişikliklerini dinle
    targetLanguageSelect.addEventListener('change', function() {
        selectedLanguage = this.value;
    });
    
    // Google Translate API için ücretsiz yöntem
    async function translateText(text, targetLang) {
        if (!text || targetLang === 'tr') {
            return text; // Türkçe seçiliyse çevirme
        }
        
        try {
            // Google Translate'in ücretsiz API'sini kullanma
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
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
        
        // SpeechRecognition nesnesini oluştur
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        // Ayarlar - performans için optimize edilmiş ayarlar
        recognition.lang = 'tr-TR'; // Türkçe konuşma tanıma
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
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
                    const translatedText = await translateText(currentText, selectedLanguage);
                    updateSubtitle(translatedText);
                }, 200); // Çok sık çeviri istekleri yapılmasını önlemek için küçük bir gecikme
            }
            
            // Konuşma durduğunda bir süre sonra metni temizle
            if (finalTranscript && finalTranscript !== '') {
                clearTimeout(displayTimeoutId);
                displayTimeoutId = setTimeout(() => {
                    fadeOutSubtitle();
                    lastFinalText = '';
                    currentText = '';
                }, 3000);
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
        
        // Hata durumunda
        recognition.onerror = (event) => {
            console.error('Konuşma tanıma hatası:', event.error);
            
            // Kritik hatalar dışında yeniden başlat
            if (event.error !== 'no-speech') {
                restartRecognition();
            }
        };
        
        // Tanıma bittiğinde yeniden başlat
        recognition.onend = () => {
            restartRecognition();
        };
        
        // Tanımayı yeniden başlatma fonksiyonu
        function restartRecognition() {
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.warn('Tanıma yeniden başlatılamadı:', e);
                    setTimeout(() => {
                        recognition.start();
                    }, 1000);
                }
            }, 100);
        }
        
        // Tanımayı başlat
        try {
            recognition.start();
        } catch (e) {
            console.error('Tanıma başlatılamadı:', e);
            setTimeout(() => {
                recognition.start();
            }, 1000);
        }
    }
    
    // Konuşma tanımayı başlat
    setupSpeechRecognition();
}); 