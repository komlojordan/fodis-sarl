// Admin UI: client-side management for products, categories, brands, and site_info.
(function(){
  const storageKeys = {
    products: 'fodis_admin_products',
    siteInfo: 'fodis_admin_site_info',
    categories: 'fodis_admin_categories',
    brands: 'fodis_admin_brands',
    assets: 'fodis_admin_assets'
  };

  // When true, products are read-only and always loaded from data/products.json
  const READ_ONLY_PRODUCTS = false;

  const state = {
    products: [],
    categories: [],
    brands: [],
    siteInfo: {},
    editingIndex: null,
    selectedImages: [],
    pendingImages: []
  };

  const assetImages = [
    'assets/product-placeholder.svg',
    'assets/logo.png',
    'assets/fodis-facade-banner.png',
    'assets/fodis-facade-banner.svg'
  ];

  const categoryIcons = {
    appareillage: 'data/icons/appareillage.svg',
    sanitaire: 'data/icons/sanitaire.svg',
    plomberie: 'data/icons/plomberie.svg',
    electricite: 'data/icons/electricite.svg',
    quincaillerie: 'data/icons/quincaillerie.svg'
  };

  function qs(sel){ return document.querySelector(sel); }

  function makeEl(tag, className, text){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(text !== undefined) el.textContent = text;
    return el;
  }

  function getSavedJSON(key, fallback){
    try{
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    }catch(e){
      return fallback;
    }
  }

  function saveJSON(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){}
  }

  function fetchFirstJSON(urls, options){
    let index = 0;

    function tryNext(){
      const url = urls[index];
      index += 1;
      return fetch(url, options)
        .then(function(response){
          if(!response.ok){
            throw new Error('Requete indisponible.');
          }
          return response.json();
        })
        .catch(function(error){
          if(index >= urls.length){
            throw error;
          }
          return tryNext();
        });
    }

    return tryNext();
  }

  function loadAssetsFromServer(){
    return fetchFirstJSON(['admin_assets.php?action=list', 'assets-list'])
      .then(function(response){
        const data = response || {};
        (data.images || []).forEach(function(src){
          if(src && !assetImages.includes(src)){
            assetImages.push(src);
          }
        });
        saveAssets();
      })
      .catch(function(){
        loadSavedAssets();
      });
  }

  function loadInitial(){
    loadAssetsFromServer();

    fetch('data/products.json')
      .then(function(r){ return r.json(); })
      .then(function(products){
        const productList = Array.isArray(products) ? products : (Array.isArray(products.products) ? products.products : []);
        state.categories = getSavedJSON(storageKeys.categories, []);
        state.brands = getSavedJSON(storageKeys.brands, []);
        // Always use the canonical products.json as the source of truth for products
        state.products = validateProducts(productList || []);
        refreshProductState();
      })
      .catch(function(){
        state.categories = getSavedJSON(storageKeys.categories, []);
        state.brands = getSavedJSON(storageKeys.brands, []);
        state.products = validateProducts(getSavedJSON(storageKeys.products, []));
        refreshProductState();
      });

    fetchFirstJSON(['site-info', 'admin_data.php?action=site-info', 'data/site_info.json', 'admin_site_info.php'])
      .then(function(siteInfo){
        state.siteInfo = getSavedJSON(storageKeys.siteInfo, siteInfo || {});
        populateSiteInfo();
      })
      .catch(function(){
        state.siteInfo = getSavedJSON(storageKeys.siteInfo, {});
        populateSiteInfo();
      });
  }

  function validateProducts(value){
    if(!Array.isArray(value)){
      throw new Error('Le fichier doit contenir une liste de produits.');
    }

    return value.map(function(product, index){
      if(!product || typeof product !== 'object' || Array.isArray(product)){
        throw new Error('Produit invalide a la ligne ' + (index + 1) + '.');
      }

      const cleaned = Object.assign({}, product);
      cleaned.id = String(cleaned.id || createProductId(cleaned.name || ('produit-' + (index + 1))));
      cleaned.name = String(cleaned.name || '');
      cleaned.category = getProductCategories(cleaned);
      cleaned.brand = String(cleaned.brand || '');
      cleaned.description = String(cleaned.description || '');
      cleaned.currency = String(cleaned.currency || 'FCFA');
      cleaned.unit = String(cleaned.unit || '');
      cleaned.weight = String(cleaned.weight || '');
      cleaned.dimensions = String(cleaned.dimensions || '');
      cleaned.color = String(cleaned.color || '');
      cleaned.availability = String(cleaned.availability || 'Disponible');
      cleaned.images = getImageList(cleaned.images || cleaned.image);
      delete cleaned.image;
      cleaned.icon = getCategoryIcon(getPrimaryCategory(cleaned));
      cleaned.price = toNullableNumber(cleaned.price);
      cleaned.currentPrice = toNullableNumber(cleaned.currentPrice);
      return cleaned;
    });
  }

  function normalizeImages(value){
    const images = getImageList(value);
    return images.length ? images : ['assets/product-placeholder.svg'];
  }

  function getImageList(value){
    const list = Array.isArray(value) ? value : [value];
    return list.map(function(item){
      return String(item || '').trim();
    }).filter(Boolean);
  }

  function parseCategories(value){
    const source = Array.isArray(value) ? value : String(value || '').split(/[;,|]/);
    const categories = [];

    source.forEach(function(item){
      const clean = String(item || '').trim();
      if(clean && !categories.some(function(category){
        return normalize(category) === normalize(clean);
      })){
        categories.push(clean);
      }
    });

    return categories;
  }

  function getProductCategories(product){
    if(!product){
      return [];
    }
    if(Array.isArray(product.category)){
      return parseCategories(product.category);
    }
    if(Array.isArray(product.categories)){
      return parseCategories(product.categories);
    }
    return parseCategories(product.category);
  }

  function getPrimaryCategory(product){
    return getProductCategories(product)[0] || '';
  }

  function formatCategories(product){
    const categories = getProductCategories(product);
    return categories.length ? categories.join(', ') : '-';
  }

  function productHasCategory(product, category){
    const selected = normalize(category);
    return getProductCategories(product).some(function(productCategory){
      return normalize(productCategory) === selected;
    });
  }

  function toNullableNumber(value){
    if(value === '' || value === null || value === undefined){
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function createProductId(name){
    return String(name || 'produit')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'produit';
  }

  function createUniqueProductId(name, currentIndex){
    const base = createProductId(name);
    let id = base;
    let count = 2;
    while(state.products.some(function(product, index){
      return product.id === id && index !== currentIndex;
    })){
      id = base + '-' + count;
      count += 1;
    }
    return id;
  }

  function getCategoryIcon(category){
    const key = normalize(category);
    return categoryIcons[key] || 'assets/product-placeholder.svg';
  }

  function refreshProductState(){
    syncCollectionsFromProducts();
    renderCategories();
    renderBrands();
    populateFilters();
    populateDatalists();
    renderProducts();
    updateDashboard();
    saveCollections();
  }

  function syncCollectionsFromProducts(){
    state.products.forEach(function(product){
      getProductCategories(product).forEach(function(category){
        addUnique(state.categories, category);
      });
      addUnique(state.brands, product.brand);
    });
    state.categories.sort(function(a, b){ return a.localeCompare(b); });
    state.brands.sort(function(a, b){ return a.localeCompare(b); });
  }

  function addUnique(list, value){
    const clean = String(value || '').trim();
    if(clean && !list.some(function(item){ return item.toLowerCase() === clean.toLowerCase(); })){
      list.push(clean);
    }
  }

  function saveCollections(){
    saveJSON(storageKeys.categories, state.categories);
    saveJSON(storageKeys.brands, state.brands);
  }

  function loadSavedAssets(){
    getSavedJSON(storageKeys.assets, []).forEach(function(src){
      if(src && !assetImages.includes(src)){
        assetImages.push(src);
      }
    });
  }

  function saveAssets(){
    saveJSON(storageKeys.assets, assetImages);
  }

  function getVisibleProducts(){
    const search = normalize(qs('#productSearch').value);
    const category = normalize(qs('#filterCategory').value);
    const brand = normalize(qs('#filterBrand').value);
    const sort = qs('#sortSelect').value;

    const visible = state.products
      .map(function(product, index){ return { product: product, index: index }; })
      .filter(function(item){
        const product = item.product;
        const searchable = normalize([
          product.name,
          product.brand,
          getProductCategories(product).join(' '),
          product.description,
          product.availability,
          product.unit,
          product.color
        ].join(' '));
        const matchesSearch = !search || searchable.includes(search);
        const matchesCategory = !category || productHasCategory(product, category);
        const matchesBrand = !brand || normalize(product.brand) === brand;
        return matchesSearch && matchesCategory && matchesBrand;
      });

    visible.sort(function(a, b){
      if(sort === 'price'){
        return Number(a.product.currentPrice || a.product.price || 0) - Number(b.product.currentPrice || b.product.price || 0);
      }
      if(sort === 'category'){
        return formatCategories(a.product).localeCompare(formatCategories(b.product));
      }
      if(sort === 'name'){
        return String(a.product.name || '').localeCompare(String(b.product.name || ''));
      }
      return a.index - b.index;
    });

    return visible;
  }

  function normalize(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function renderProducts(){
    const tbody = qs('#productsTable tbody');
    const empty = qs('#productsEmpty');
    tbody.innerHTML = '';

    const visible = getVisibleProducts();
    empty.classList.toggle('show', visible.length === 0);

    visible.forEach(function(item){
      const p = item.product;
      const tr = document.createElement('tr');

      const imageCell = document.createElement('td');
      const img = document.createElement('img');
      img.src = getPrimaryImage(p);
      img.alt = p.name || '';
      imageCell.appendChild(img);

      tr.appendChild(imageCell);
      tr.appendChild(makeEl('td', '', p.name || 'Sans nom'));
      tr.appendChild(makeEl('td', 'category-cell', formatCategories(p)));
      tr.appendChild(makeEl('td', '', p.brand || '-'));
      tr.appendChild(makeEl('td', '', formatPrice(p)));
      tr.appendChild(makeEl('td', '', p.availability || '-'));

      const actions = document.createElement('td');
      if(!READ_ONLY_PRODUCTS){
        const edit = makeEl('button', 'edit', 'Modifier');
        const del = makeEl('button', 'delete secondary', 'Supprimer');
        edit.type = 'button';
        del.type = 'button';
        edit.dataset.idx = item.index;
        del.dataset.idx = item.index;
        actions.appendChild(edit);
        actions.appendChild(del);
      }else{
        actions.textContent = 'Lecture seule';
      }
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
  }

  function formatPrice(product){
    const price = product.currentPrice !== null && product.currentPrice !== undefined ? product.currentPrice : product.price;
    if(price === null || price === undefined || price === ''){
      return '-';
    }
    return Number(price).toLocaleString('fr-FR') + ' ' + (product.currency || 'FCFA');
  }

  function getPrimaryImage(product){
    return normalizeImages(product.images || product.image)[0];
  }

  function updateDashboard(){
    qs('#totalProducts').textContent = state.products.length;
    qs('#totalCategories').textContent = state.categories.length;
    qs('#totalBrands').textContent = state.brands.length;
    qs('#outOfStock').textContent = state.products.filter(isUnavailable).length;
  }

  function isUnavailable(product){
    if(product.stock !== undefined && product.stock !== null && product.stock !== ''){
      return Number(product.stock) <= 0;
    }
    return !normalize(product.availability).includes('disponible');
  }

  function populateFilters(){
    const categorySelect = qs('#filterCategory');
    const currentCategory = categorySelect.value;
    categorySelect.innerHTML = '';
    categorySelect.appendChild(new Option('Toutes catégories', ''));
    state.categories.forEach(function(category){
      categorySelect.appendChild(new Option(category, category));
    });
    categorySelect.value = state.categories.includes(currentCategory) ? currentCategory : '';

    const brandSelect = qs('#filterBrand');
    const currentBrand = brandSelect.value;
    brandSelect.innerHTML = '';
    brandSelect.appendChild(new Option('Toutes marques', ''));
    state.brands.forEach(function(brand){
      brandSelect.appendChild(new Option(brand, brand));
    });
    brandSelect.value = state.brands.includes(currentBrand) ? currentBrand : '';
  }

  function populateDatalists(){
    const categoryOptions = qs('#categoryOptions');
    const brandOptions = qs('#brandOptions');
    categoryOptions.innerHTML = '';
    brandOptions.innerHTML = '';

    state.categories.forEach(function(category){
      const option = document.createElement('option');
      option.value = category;
      categoryOptions.appendChild(option);
    });

    state.brands.forEach(function(brand){
      const option = document.createElement('option');
      option.value = brand;
      brandOptions.appendChild(option);
    });
  }

  function setupListeners(){
    qs('#productSearch').addEventListener('input', renderProducts);
    qs('#filterCategory').addEventListener('change', renderProducts);
    qs('#filterBrand').addEventListener('change', renderProducts);
    qs('#sortSelect').addEventListener('change', renderProducts);
    const addBtn = qs('#addProductBtn');
    if(addBtn){
      if(READ_ONLY_PRODUCTS){
        addBtn.disabled = true;
        addBtn.textContent = 'Lecture seule';
      }else{
        addBtn.addEventListener('click', function(){ openProductDialog(); });
      }
    }

    qs('#addCategory').addEventListener('click', addCategoryFromInput);
    qs('#newCategory').addEventListener('keydown', function(event){
      if(event.key === 'Enter') addCategoryFromInput();
    });

    qs('#addBrand').addEventListener('click', addBrandFromInput);
    qs('#newBrand').addEventListener('keydown', function(event){
      if(event.key === 'Enter') addBrandFromInput();
    });

    qs('#exportProducts').addEventListener('click', function(){
      downloadJSON(state.products, 'products.json');
    });

    qs('#productsTable').addEventListener('click', function(e){
      if(READ_ONLY_PRODUCTS) return; // prevent edits/deletes in read-only mode
      if(e.target.classList.contains('delete')){
        const i = Number(e.target.dataset.idx);
        if(confirm('Supprimer ce produit ?')){
          state.products.splice(i, 1);
          saveProducts();
          refreshProductState();
        }
      }
      if(e.target.classList.contains('edit')){
        openProductDialog(Number(e.target.dataset.idx));
      }
    });

    qs('#productForm').addEventListener('submit', saveProductFromForm);
    qs('#cancelProduct').addEventListener('click', closeProductDialog);
    qs('#closeProductDialog').addEventListener('click', closeProductDialog);
    qs('#chooseImagesBtn').addEventListener('click', openImageDialog);
    qs('#closeImageDialog').addEventListener('click', closeImageDialog);
    qs('#cancelImages').addEventListener('click', closeImageDialog);
    qs('#applyImages').addEventListener('click', applySelectedImages);
    qs('#uploadImage').addEventListener('change', handleImageUpload);

    qs('#saveSiteInfo').addEventListener('click', function(){
      state.siteInfo.name = qs('#si_name').value.trim();
      state.siteInfo.tagline = qs('#si_tagline').value.trim();
      state.siteInfo.phones = [qs('#si_phone').value.trim()].filter(Boolean);
      state.siteInfo.whatsapp = qs('#si_whatsapp').value.trim();
      state.siteInfo.email = qs('#si_email').value.trim();
      state.siteInfo.address = qs('#si_address').value.trim();
      state.siteInfo.hours = qs('#si_hours').value.trim();
      delete state.siteInfo.pw;
      saveJSON(storageKeys.siteInfo, state.siteInfo);
      persistSiteInfo();
    });

    qs('#exportSiteInfo').addEventListener('click', function(){
      downloadJSON(state.siteInfo, 'site_info-export.json');
    });
  }

  function addCategoryFromInput(){
    const input = qs('#newCategory');
    addUnique(state.categories, input.value);
    input.value = '';
    state.categories.sort(function(a, b){ return a.localeCompare(b); });
    renderCategories();
    populateFilters();
    populateDatalists();
    updateDashboard();
    saveCollections();
  }

  function addBrandFromInput(){
    const input = qs('#newBrand');
    addUnique(state.brands, input.value);
    input.value = '';
    state.brands.sort(function(a, b){ return a.localeCompare(b); });
    renderBrands();
    populateDatalists();
    updateDashboard();
    saveCollections();
  }

  function renderCategories(){
    const ul = qs('#categoriesList');
    ul.innerHTML = '';

    state.categories.forEach(function(category, i){
      const li = makeEl('li');
      li.appendChild(makeEl('span', '', category));
      const b = makeEl('button', 'secondary', 'Supprimer');
      b.type = 'button';
      b.addEventListener('click', function(){
        const inUse = state.products.some(function(product){
          return productHasCategory(product, category);
        });
        if(inUse && !confirm('Cette catégorie est utilisée par des produits. La retirer aussi de ces produits ?')){
          return;
        }
        state.products.forEach(function(product){
          product.category = getProductCategories(product).filter(function(productCategory){
            return normalize(productCategory) !== normalize(category);
          });
          if(product.category.length === 0){
            product.category = ['Autre'];
          }
          product.icon = getCategoryIcon(getPrimaryCategory(product));
        });
        state.categories.splice(i, 1);
        saveProducts();
        refreshProductState();
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function renderBrands(){
    const ul = qs('#brandsList');
    ul.innerHTML = '';

    state.brands.forEach(function(brand, i){
      const li = makeEl('li');
      li.appendChild(makeEl('span', '', brand));
      const b = makeEl('button', 'secondary', 'Supprimer');
      b.type = 'button';
      b.addEventListener('click', function(){
        state.brands.splice(i, 1);
        renderBrands();
        populateDatalists();
        updateDashboard();
        saveCollections();
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function populateSiteInfo(){
    qs('#si_name').value = state.siteInfo.name || '';
    qs('#si_tagline').value = state.siteInfo.tagline || '';
    qs('#si_phone').value = (state.siteInfo.phones && state.siteInfo.phones[0]) || state.siteInfo.phone || '';
    qs('#si_whatsapp').value = state.siteInfo.whatsapp || '';
    qs('#si_email').value = state.siteInfo.email || '';
    qs('#si_address').value = state.siteInfo.address || '';
    qs('#si_hours').value = state.siteInfo.hours || '';
  }

  function openProductDialog(index){
    state.editingIndex = Number.isInteger(index) ? index : null;
    const product = state.editingIndex === null ? defaultProduct() : state.products[state.editingIndex];
    qs('#productDialogTitle').textContent = state.editingIndex === null ? 'Ajouter un produit' : 'Modifier le produit';
    fillProductForm(product);
    qs('#productDialog').showModal();
    qs('#pf_name').focus();
  }

  function closeProductDialog(){
    qs('#productDialog').close();
    state.editingIndex = null;
  }

  function defaultProduct(){
    return {
      id: '',
      name: '',
      brand: '',
      category: [],
      description: '',
      price: null,
      currentPrice: null,
      currency: 'FCFA',
      unit: '',
      weight: '',
      dimensions: '',
      color: '',
      availability: 'Disponible',
      images: [],
      icon: 'assets/product-placeholder.svg'
    };
  }

  function fillProductForm(product){
    qs('#pf_name').value = product.name || '';
    qs('#pf_category').value = getProductCategories(product).join(', ');
    qs('#pf_brand').value = product.brand || '';
    qs('#pf_price').value = product.price || '';
    qs('#pf_currentPrice').value = product.currentPrice || '';
    qs('#pf_currency').value = product.currency || 'FCFA';
    qs('#pf_unit').value = product.unit || '';
    qs('#pf_weight').value = product.weight || '';
    qs('#pf_dimensions').value = product.dimensions || '';
    qs('#pf_color').value = product.color || '';
    qs('#pf_availability').value = product.availability || 'Disponible';
    qs('#pf_description').value = product.description || '';
    state.selectedImages = getImageList(product.images || product.image);
    renderSelectedImages();
  }

  function saveProductFromForm(event){
    event.preventDefault();

    const product = {
      id: state.editingIndex === null ?
        createUniqueProductId(qs('#pf_name').value, null) :
        (state.products[state.editingIndex].id || createUniqueProductId(qs('#pf_name').value, state.editingIndex)),
      name: qs('#pf_name').value.trim(),
      brand: qs('#pf_brand').value.trim(),
      category: parseCategories(qs('#pf_category').value),
      description: qs('#pf_description').value.trim(),
      price: toNullableNumber(qs('#pf_price').value),
      currentPrice: toNullableNumber(qs('#pf_currentPrice').value),
      currency: qs('#pf_currency').value.trim() || 'FCFA',
      unit: qs('#pf_unit').value.trim(),
      weight: qs('#pf_weight').value.trim(),
      dimensions: qs('#pf_dimensions').value.trim(),
      color: qs('#pf_color').value.trim(),
      availability: qs('#pf_availability').value.trim() || 'Disponible',
      images: getImageList(state.selectedImages),
      icon: getCategoryIcon(parseCategories(qs('#pf_category').value)[0])
    };

    if(!product.name || product.category.length === 0){
      alert('Le nom et la catégorie sont obligatoires.');
      return;
    }

    if(state.editingIndex === null){
      state.products.push(product);
    }else{
      state.products[state.editingIndex] = product;
    }

    saveProducts();
    closeProductDialog();
    refreshProductState();
  }

  function saveProducts(){
    // In read-only mode we still keep a local snapshot but do not persist to server
    saveJSON(storageKeys.products, state.products);
    if(READ_ONLY_PRODUCTS){
      console.warn('READ_ONLY_PRODUCTS: modifications are not persisted to server.');
      return;
    }
    persistProducts();
  }

  function persistProducts(){
    fetchFirstJSON(['save-products', 'admin_data.php?action=products'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.products)
    }).catch(function(){});
  }

  function persistSiteInfo(){
    fetchFirstJSON(['site-info', 'admin_data.php?action=site-info'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.siteInfo)
    })
      .then(function(){
        alert('Informations enregistrées dans data/site_info.json.');
      })
      .catch(function(){
        alert('Informations enregistrées localement. Utilisez Exporter si le serveur admin nest pas lancé.');
      });
  }

  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }

  function downloadCSV(products, filename){
    const columns = [
      'id',
      'name',
      'brand',
      'category',
      'description',
      'price',
      'currentPrice',
      'currency',
      'unit',
      'weight',
      'dimensions',
      'color',
      'availability',
      'images',
      'icon'
    ];
    const rows = [columns.join(',')].concat(products.map(function(product){
      return columns.map(function(column){
        return csvCell(Array.isArray(product[column]) ? product[column].join('|') : product[column]);
      }).join(',');
    }));
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }

  function csvCell(value){
    const text = value === null || value === undefined ? '' : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function renderSelectedImages(){
    const wrapper = qs('#selectedImages');
    wrapper.innerHTML = '';

    const selected = getImageList(state.selectedImages);
    if(selected.length === 0){
      wrapper.appendChild(makeEl('p', 'empty-images', 'Aucune image sélectionnée.'));
      return;
    }

    selected.forEach(function(src, index){
      const item = makeEl('button', 'selected-image');
      item.type = 'button';
      item.title = src;
      item.innerHTML = '';

      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      item.appendChild(img);

      const remove = makeEl('span', '', 'Retirer');
      item.appendChild(remove);
      item.addEventListener('click', function(){
        state.selectedImages.splice(index, 1);
        renderSelectedImages();
      });
      wrapper.appendChild(item);
    });
  }

  function openImageDialog(){
    state.pendingImages = getImageList(state.selectedImages).slice();
    renderAssetGrid();
    qs('#imageDialog').showModal();
  }

  function closeImageDialog(){
    qs('#imageDialog').close();
  }

  function renderAssetGrid(){
    const grid = qs('#assetGrid');
    const allImages = Array.from(new Set(assetImages.concat(state.selectedImages || [])));
    grid.innerHTML = '';

    allImages.forEach(function(src){
      const button = makeEl('button', 'asset-card');
      button.type = 'button';
      const selectedIndex = state.pendingImages.indexOf(src);
      button.classList.toggle('active', selectedIndex !== -1);
      if(selectedIndex !== -1){
        button.dataset.order = String(selectedIndex + 1);
        const number = makeEl('strong', 'asset-number', String(selectedIndex + 1));
        button.appendChild(number);
      }

      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      button.appendChild(img);
      button.appendChild(makeEl('span', '', src.replace(/^assets\//, '')));

      button.addEventListener('click', function(){
        if(state.pendingImages.includes(src)){
          state.pendingImages = state.pendingImages.filter(function(item){ return item !== src; });
        }else{
          state.pendingImages.push(src);
        }
        renderAssetGrid();
      });

      grid.appendChild(button);
    });
  }

  function applySelectedImages(){
    state.selectedImages = getImageList(state.pendingImages);
    renderSelectedImages();
    closeImageDialog();
  }

  function fileToDataURL(file){
    return new Promise(function(resolve, reject){
      const reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleImageUpload(event){
    const files = Array.from(event.target.files || []);
    if(!files.length){
      return;
    }

    try{
      for(const file of files){
        const payload = {
          filename: file.name,
          data: await fileToDataURL(file)
        };
        const result = await fetchFirstJSON(['admin_assets.php?action=upload', 'upload-assets'], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const path = result.path;
        if(!assetImages.includes(path)){
          assetImages.push(path);
        }
        if(!state.pendingImages.includes(path)){
          state.pendingImages.push(path);
        }
      }
      saveAssets();
      renderAssetGrid();
    }catch(error){
      alert('Impossible de téléverser l’image. Ouvrez cette page depuis un serveur PHP pour activer l’ajout dans assets.');
    }
    event.target.value = '';
  }

  document.addEventListener('DOMContentLoaded', function(){
    setupListeners();
    loadInitial();
  });
})();
