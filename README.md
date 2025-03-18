# Webcam Altyazı Uygulaması

Bu uygulama, webcam görüntünüzü tam ekran gösterip, konuşmalarınızı ekranın alt kısmında altyazı olarak eşzamanlı gösterir.

## Özellikler

- Tam ekran webcam görüntüsü
- Konuşma tanıma ile gerçek zamanlı altyazı
- Cümle bitiminde altyazıların birkaç saniye ekranda kalıp otomatik silinmesi
- Türkçe dil desteği
- Express sunucu desteği

## Kurulum

```bash
# Bağımlılıkları yükleyin
npm install
```

## Nasıl Çalıştırılır

1. Express sunucusunu başlatın:

```bash
# Normal başlatma
npm start

# Veya geliştirme modunda (otomatik yeniden başlatma ile)
npm run dev
```

2. Tarayıcınızda `http://localhost:3000` adresine gidin

3. Tarayıcı kamera erişimi için izin isteyecektir, izin verin.

4. Konuşmaya başlayın - kelimeler altyazı olarak ekranda belirecektir.

## Gereksinimler

- Node.js ve npm
- Modern bir web tarayıcısı (Chrome, Edge, Firefox tavsiye edilir)
- Kamera erişimi
- Web Speech API desteği olan bir tarayıcı

## Not

Bu uygulama için herhangi bir sunucu taraflı bileşen gerekmez, tamamen istemci tarafında çalışır. 