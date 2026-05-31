// Load public site information and populate the page
(function(){
  function digitsOnly(s){ return s.replace(/[^0-9+]/g,'').replace(/^\+/, ''); }

  fetch('site_info_public.php')
    .then(r=>r.json())
    .then(data=>{
      if(!data) return;
      try{
        document.title = data.name || document.title;
        const nameEl = document.getElementById('siteName');
        if(nameEl) nameEl.textContent = data.name;
        const tagEl = document.getElementById('siteTagline');
        if(tagEl && data.tagline) tagEl.textContent = data.tagline;

        const logoImg = document.querySelector('.brand-logo img');
        if(logoImg) logoImg.alt = data.name;

        const phoneEl = document.getElementById('headerPhone');
        const phoneAction = document.getElementById('phoneAction');
        if(phoneEl && data.phones && data.phones.length){
          phoneEl.textContent = data.phones[0];
          if(phoneAction) phoneAction.href = 'tel:' + data.phones[0].replace(/\s+/g,'');
        }

        const wa = document.getElementById('whatsappAction');
        const waLabel = document.getElementById('whatsappLabel');
        if(wa && data.whatsapp){
          const num = digitsOnly(data.whatsapp);
          const defaultMessage = data.whatsapp_message || ('Bonjour ' + (data.name||'') + ', je souhaite avoir plus d\'informations sur vos produits.');
          wa.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(defaultMessage);
          wa.setAttribute('data-whatsapp-number', data.whatsapp);
          if(waLabel) waLabel.textContent = data.whatsapp_label || 'WhatsApp';
        }

        const searchInput = document.getElementById('searchInput');
        if(searchInput) searchInput.placeholder = 'Rechercher chez ' + (data.name || 'notre boutique');

        // update any elements that had data-whatsapp-message template
        document.querySelectorAll('[data-whatsapp-message]').forEach(el=>{
          const msg = el.getAttribute('data-whatsapp-message') || '';
          el.setAttribute('data-whatsapp-message', msg.replace(/FODIS SARL/g, data.name || '')); 
        });
      }catch(e){ console.error('site-info error', e); }
    })
    .catch(err=>console.warn('Could not load site_info.json', err));
})();
