import emailjs from '@emailjs/browser';

// Initialize EmailJS with your public key
emailjs.init("-vX-Xu0v-kys4kH1Z");

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          // Very small size for email
          const maxSize = 200;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = Math.floor(width);
          canvas.height = Math.floor(height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Very low quality for smaller size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.1);
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Track email sending status with timestamps
const emailLock = {
  locked: false,
  timestamp: 0,
  timeout: null as NodeJS.Timeout | null,
};

export async function sendNotificationEmail(params: {
  room_number: string;
  notes: string;
  images: File[];
  cleaning_types: string[];
  staff_name: string;
}): Promise<any> {
  const now = Date.now();
  
  // Prevent rapid-fire submissions (within 10 seconds)
  if (emailLock.locked || (now - emailLock.timestamp < 10000)) {
    console.log('Preventing duplicate email, too soon after last send');
    return null;
  }

  // Lock sending and update timestamp
  emailLock.locked = true;
  emailLock.timestamp = now;

  try {
    let imageHtml = '';
    
    if (params.images.length > 0) {
      try {
        const compressed = await compressImage(params.images[0]);
        imageHtml = `<img src="${compressed}" style="max-width:200px;margin:10px 0;" alt="Foto">`;
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }

    const templateParams = {
      to_name: "Benito Marconi",
      to_email: "b.marconi@kv-vorderpfalz.drk.de",
      from_name: params.staff_name,
      room_number: params.room_number,
      cleaning_types: params.cleaning_types.join(', '),
      notes: params.notes || 'Keine Notizen',
      image_html: imageHtml,
      date_time: new Date().toLocaleString('de-DE')
    };

    const response = await emailjs.send(
      'service_2aqxvxr',
      'template_drk_hw',
      templateParams
    );
    
    console.log('Email sent successfully');
    return response;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  } finally {
    // Clear any existing timeout
    if (emailLock.timeout) {
      clearTimeout(emailLock.timeout);
    }
    
    // Set new timeout to unlock after 10 seconds
    emailLock.timeout = setTimeout(() => {
      emailLock.locked = false;
      emailLock.timeout = null;
    }, 10000);
  }
}