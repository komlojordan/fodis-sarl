// Load public site information and populate the page
(function(){
  function digitsOnly(s){ return s.replace(/[^0-9+]/g,'').replace(/^\+/, ''); }

  function fetchFirstJSON(urls){
    let index = 0;

    function tryNext(){
      const url = urls[index];
      index += 1;

      return fetch(url)
        .then(r=>{
          if(!r.ok) throw new Error('site info unavailable');
          return r.json();
        })
        .catch(error=>{
          if(index >= urls.length) throw error;
          return tryNext();
        });
    }

    return tryNext();
  }

  fetchFirstJSON(['site_info_public.php', 'site-info', 'data/site_info.json'])
    .then(data=>{
      if(!data) return;
      try{
        const name = data.name || (data.coordonnees && data.coordonnees.name) || 'FODIS SARL';
        document.title = name || document.title;
        const nameEl = document.getElementById('siteName');
        if(nameEl) nameEl.textContent = name;

        const tagline = data.tagline || (data.reseaux_sociaux && data.reseaux_sociaux.tagline);
        const tagEl = document.getElementById('siteTagline');
        if(tagEl && tagline) tagEl.textContent = tagline;

        const logoImg = document.querySelector('.brand-logo img');
        if(logoImg) logoImg.alt = name;

        let phones = [];
        if (data.phones && data.phones.length) {
          phones = data.phones;
        } else if (data.coordonnees && data.coordonnees.phone) {
          phones = [data.coordonnees.phone];
        } else if (data.phone) {
          phones = [data.phone];
        }

        const phoneEl = document.getElementById('headerPhone');
        const phoneAction = document.getElementById('phoneAction');
        if(phoneEl && phones.length){
          phoneEl.textContent = phones[0];
          if(phoneAction) phoneAction.href = 'tel:' + phones[0].replace(/\s+/g,'');
        }

        const whatsapp = data.whatsapp || (data.reseaux_sociaux && data.reseaux_sociaux.whatsapp);
        const whatsapp_message = data.whatsapp_message || (data.reseaux_sociaux && data.reseaux_sociaux.whatsapp_message);
        const whatsapp_label = data.whatsapp_label || (data.reseaux_sociaux && data.reseaux_sociaux.whatsapp_label);

        const wa = document.getElementById('whatsappAction');
        const waLabel = document.getElementById('whatsappLabel');
        if(wa && whatsapp){
          const num = digitsOnly(whatsapp);
          const defaultMessage = whatsapp_message || ('Bonjour ' + (name||'') + ', je souhaite avoir plus d\'informations sur vos produits.');
          wa.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(defaultMessage);
          wa.setAttribute('data-whatsapp-number', whatsapp);
          if(waLabel) waLabel.textContent = whatsapp_label || 'WhatsApp';
        }

        const searchInput = document.getElementById('searchInput');
        if(searchInput) searchInput.placeholder = 'Rechercher chez ' + (name || 'notre boutique');

        // update any elements that had data-whatsapp-message template
        document.querySelectorAll('[data-whatsapp-message]').forEach(el=>{
          const msg = el.getAttribute('data-whatsapp-message') || '';
          el.setAttribute('data-whatsapp-message', msg.replace(/FODIS SARL/g, name || '')); 
        });
      }catch(e){ console.error('site-info error', e); }
    })
    .catch(err=>console.warn('Could not load site_info.json', err));
})();
