const categories = [
  {
    id: 'tronc',
    name: 'Tronc commun ST',
    books: [
      {
        id: 'math-analyse',
        title: 'Analyse pour sciences et techniques',
        price: 1200,
        description: 'Bases d’analyse pour 1ère année ST.',
      },
      {
        id: 'physique-1',
        title: 'Physique générale I',
        price: 1100,
        description: 'Mécanique, cinématique et dynamique.',
      },
    ],
  },
  {
    id: 'mecanique',
    name: 'Mécanique énergétique',
    books: [
      {
        id: 'thermo',
        title: 'Thermodynamique appliquée',
        price: 1300,
        description: 'Cycles, rendement, bilans énergétiques.',
      },
      {
        id: 'meca-flu',
        title: 'Mécanique des fluides',
        price: 1250,
        description: 'Écoulements, pertes de charge, pompes.',
      },
    ],
  },
  {
    id: 'genie-civil',
    name: 'Génie civil',
    books: [
      {
        id: 'beton',
        title: 'Béton armé pratique',
        price: 1400,
        description: 'Dimensionnement et exemples de calcul.',
      },
      {
        id: 'topographie',
        title: 'Topographie et implantations',
        price: 900,
        description: 'Méthodes terrain, nivellement, instruments.',
      },
    ],
  },
  {
    id: 'electronique',
    name: 'Électronique',
    books: [
      {
        id: 'circuits',
        title: 'Circuits électroniques',
        price: 1000,
        description: 'Composants, montages de base, signaux.',
      },
      {
        id: 'numerique',
        title: 'Logique numérique',
        price: 950,
        description: 'Portes logiques, séquenceurs, FPGA intro.',
      },
    ],
  },
  {
    id: 'chimie',
    name: 'Chimie',
    books: [
      {
        id: 'chimie-org',
        title: 'Chimie organique',
        price: 1050,
        description: 'Fonctions, réactions, mécanismes.',
      },
      {
        id: 'chimie-analytique',
        title: 'Chimie analytique',
        price: 980,
        description: 'Dosages, spectroscopie, sécurité labo.',
      },
    ],
  },
  {
    id: 'biologie',
    name: 'Biologie',
    books: [
      {
        id: 'biologie-cellulaire',
        title: 'Biologie cellulaire',
        price: 950,
        description: 'Structure, membranes, organites.',
      },
      {
        id: 'microbio',
        title: 'Microbiologie',
        price: 1020,
        description: 'Bactéries, virus, méthodes de culture.',
      },
    ],
  },
];

const state = {
  cart: [],
  deliveryFee: 0,
  activeCategory: categories[0].id,
};

document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  renderBooks(state.activeCategory);
  updateCartUI();
  fetchConfig();
  setupForm();
});

function fetchConfig() {
  fetch('/api/config')
    .then((res) => res.json())
    .then((config) => {
      state.deliveryFee = Number(config.deliveryFee || 0);
      updateTotals();
    })
    .catch(() => {
      state.deliveryFee = 0;
      updateTotals();
    });
}

function renderTabs() {
  const tabContainer = document.getElementById('category-tabs');
  tabContainer.innerHTML = '';
  categories.forEach((cat) => {
    const button = document.createElement('button');
    button.className = `tab ${state.activeCategory === cat.id ? 'active' : ''}`;
    button.textContent = cat.name;
    button.addEventListener('click', () => {
      state.activeCategory = cat.id;
      renderTabs();
      renderBooks(cat.id);
    });
    tabContainer.appendChild(button);
  });
}

function renderBooks(categoryId) {
  const grid = document.getElementById('books-grid');
  grid.innerHTML = '';
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return;

  category.books.forEach((book) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <h3>${book.title}</h3>
        <p>${book.description}</p>
      </div>
      <div class="price">${formatPrice(book.price)}</div>
    `;
    const addBtn = document.createElement('button');
    addBtn.className = 'cta';
    addBtn.textContent = 'Ajouter au panier';
    addBtn.addEventListener('click', () => addToCart(book, category.name));
    card.appendChild(addBtn);
    grid.appendChild(card);
  });
}

function addToCart(book, categoryName) {
  const existing = state.cart.find((item) => item.id === book.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...book, category: categoryName, quantity: 1 });
  }
  updateCartUI();
  document.getElementById('cart-empty').style.display = 'none';
}

function updateCartUI() {
  const container = document.getElementById('cart-items');
  container.innerHTML = '';
  if (state.cart.length === 0) {
    document.getElementById('cart-empty').style.display = 'block';
  } else {
    document.getElementById('cart-empty').style.display = 'none';
  }

  state.cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-details">
        <div><strong>${item.title}</strong> · <span class="muted">${item.category}</span></div>
        <div>${formatPrice(item.price)}</div>
      </div>
    `;
    const qtyBox = document.createElement('div');
    qtyBox.className = 'qty';
    const minus = document.createElement('button');
    minus.textContent = '-';
    minus.addEventListener('click', () => changeQuantity(item.id, -1));
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.addEventListener('click', () => changeQuantity(item.id, 1));
    const qtyLabel = document.createElement('span');
    qtyLabel.textContent = item.quantity;
    qtyBox.append(minus, qtyLabel, plus);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove';
    removeBtn.textContent = 'Retirer';
    removeBtn.addEventListener('click', () => removeFromCart(item.id));

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';
    right.append(qtyBox, removeBtn);

    row.appendChild(right);
    container.appendChild(row);
  });

  updateTotals();
}

function updateTotals() {
  const subtotal = state.cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  document.getElementById('subtotal').textContent = formatPrice(subtotal);
  document.getElementById('shipping').textContent = formatPrice(state.deliveryFee);
  document.getElementById('grand-total').textContent = formatPrice(
    subtotal + state.deliveryFee
  );
}

function changeQuantity(id, delta) {
  const item = state.cart.find((i) => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(id);
  }
  updateCartUI();
}

function removeFromCart(id) {
  state.cart = state.cart.filter((i) => i.id !== id);
  updateCartUI();
}

function setupForm() {
  const form = document.getElementById('checkout-form');
  const errorBox = document.getElementById('form-error');
  const successBox = document.getElementById('form-success');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    successBox.hidden = true;

    if (state.cart.length === 0) {
      showError('Ajoutez au moins un livre avant de commander.');
      return;
    }

    const formData = new FormData(form);
    const payload = {
      lastName: formData.get('lastName').trim(),
      firstName: formData.get('firstName').trim(),
      phone: formData.get('phone').trim(),
      wilaya: formData.get('wilaya').trim(),
      deliveryMode: formData.get('deliveryMode'),
      items: state.cart.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        category: item.category,
      })),
    };

    const missing = ['lastName', 'firstName', 'phone', 'wilaya', 'deliveryMode'].find(
      (field) => !payload[field]
    );
    if (missing) {
      showError('Tous les champs obligatoires doivent être remplis.');
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur serveur');
      }

      successBox.textContent = 'Commande validée ! Nous vous contacterons pour la livraison.';
      successBox.hidden = false;
      state.cart = [];
      updateCartUI();
      form.reset();
    } catch (error) {
      showError(error.message);
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
}

function formatPrice(value) {
  return `${Number(value).toLocaleString('fr-DZ')} DA`;
}
