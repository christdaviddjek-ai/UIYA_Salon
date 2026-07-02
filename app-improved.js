// ══════════════════════════════════════════════════════════════
//  app-improved.js  –  Code Optimisé & Maintainable
//  Services · Validation · Error Handling · Debounce
// ══════════════════════════════════════════════════════════════

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════════════
   UTILITIES & HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Debounce une fonction pour éviter les appels répétés
 * @param {Function} fn - Fonction à debouncer
 * @param {number} delay - Délai en ms (défaut: 300ms)
 * @returns {Function} Fonction debouncer
 */
const debounce = (fn, delay = 300) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
};

/**
 * Utilitaire pour récupérer les éléments du DOM
 */
const DOM = {
  get(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element #${id} not found`);
    return el;
  },
  
  qs(selector) {
    return document.querySelector(selector);
  },
  
  qsa(selector) {
    return document.querySelectorAll(selector);
  }
};

/**
 * Logger avec context
 */
const Logger = {
  info(msg, data) {
    console.log(`[INFO] ${msg}`, data || '');
  },
  
  error(msg, error) {
    console.error(`[ERROR] ${msg}`, error || '');
  },
  
  warn(msg, data) {
    console.warn(`[WARN] ${msg}`, data || '');
  }
};

const STORAGE_KEYS = {
  waJoined: 'uiya-wa-joined',
  waVisitorSaved: 'uiya-wa-visitor-saved',
  skipPreinscription: 'uiya-wa-skip-preinscription'
};

const WA_JOIN_URL = 'https://chat.whatsapp.com/BbNsuZ2uAcX0CyqQEn2Uhf?mode=gi_t';

const FORM_IDS = {
  visitor: 'visitorForm',
  prereg: 'preregForm'
};

let userJoinedWA = false;
let waVisitorSaved = false;
let savedVisitorId = null;
let forceWAFormMode = false;

function clearVisitorSavedState() {
  waVisitorSaved = false;
  savedVisitorId = null;
  localStorage.removeItem('uiya-wa-visitor-saved');
}

function markWAJoined() {
  userJoinedWA = true;
  forceWAFormMode = false;
  localStorage.setItem('uiya-wa-joined', '1');
  updateWAModalUI();
}

function markVisitorSaved() {
  waVisitorSaved = true;
  localStorage.setItem('uiya-wa-visitor-saved', '1');
  savedVisitorId = null;
}

function markVisitorSavedWithId(id) {
  waVisitorSaved = true;
  savedVisitorId = id;
  localStorage.setItem('uiya-wa-visitor-saved', '1');
}

function isVisitorSaved() {
  return waVisitorSaved || localStorage.getItem('uiya-wa-visitor-saved') === '1';
}

function getWAStatus() {
  return userJoinedWA || localStorage.getItem('uiya-wa-joined') === '1';
}

function setWAJoinEnabled(enabled) {
  const joinButton = document.getElementById('waJoinButton');
  if (!joinButton) return;
  if (enabled) {
    joinButton.classList.remove('disabled');
    joinButton.removeAttribute('aria-disabled');
  } else {
    joinButton.classList.add('disabled');
    joinButton.setAttribute('aria-disabled', 'true');
  }
}

function updateWAModalUI() {
  const waContent = DOM.get('waContent');
  const waSuccess = DOM.get('waSuccess');
  const joined = getWAStatus();
  const visitorSaved = isVisitorSaved();
  const showForm = forceWAFormMode || !joined;

  if (waContent && waSuccess) {
    if (showForm) {
      waContent.classList.remove('hidden');
      waSuccess.classList.remove('active');
      setWAJoinEnabled(visitorSaved);
    } else {
      waContent.classList.add('hidden');
      waSuccess.classList.add('active');
      setWAJoinEnabled(false);
    }
  }
}

function shouldAutoOpenWAModal() {
  if (!getWAStatus()) return false;
  return localStorage.getItem('uiya-wa-skip-preinscription') !== '1';
}

function isModalActive(modalId) {
  const modal = DOM.get(modalId);
  return modal ? modal.classList.contains('active') : false;
}

function openWAModalOnReturn() {
  if (!shouldAutoOpenWAModal()) return;
  if (isModalActive('modalWA')) return;
  updateWAModalUI();
  ModalService.open('modalWA');
}

// NEW: saveVisitorInfo avec villeVisite support
async function saveVisitorInfo() {
  const nom = DOM.get('waNom')?.value?.trim();
  const prenom = DOM.get('waPrenom')?.value?.trim();
  const villeVisite = DOM.get('waVilleVisite')?.value?.trim();
  const serie = DOM.get('waSerie')?.value?.trim();
  const filiere = DOM.get('waFiliere')?.value?.trim();

  if (!nom || !prenom || !villeVisite || !serie || !filiere) {
    notify.error('Tous les champs sont requis.');
    return false;
  }

  try {
    // Check for duplicate visitor in same city
    const qV = query(
      collection(db, 'preinscriptions'),
      where('nom', '==', nom),
      where('prenom', '==', prenom),
      where('villeVisite', '==', villeVisite),
      where('source', '==', 'stand')
    );
    const sV = await getDocs(qV);
    if (!sV.empty) {
      notify.warning('Une visite avec ce nom et prenom existe deja dans cette ville.');
      return false;
    }

    const visitorData = {
      nom,
      prenom,
      villeVisite,
      serie,
      filiere,
      groupeWA: false,
      statut: 'valide',
      source: 'stand',
      createdAt: serverTimestamp(),
      validatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'preinscriptions'), visitorData);
    Logger.info('Visiteur stand enregistre', { id: docRef.id, villeVisite, visitorData });
    notify.success('Visite enregistree! Rejoignez le groupe WA.');
    markVisitorSavedWithId(docRef.id);
    setWAJoinEnabled(true);
    updateWAModalUI();

    const form = document.getElementById('visitorForm');
    if (form) form.reset();

    return true;
  } catch (error) {
    Logger.error('Erreur en enregistrant la visite', error);
    notify.error('Impossible d\'enregistrer vos informations. Reessayez.');
    return false;
  }
}

window.saveVisitorInfo = saveVisitorInfo;

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION SERVICE
══════════════════════════════════════════════════════════════ */

class NotificationService {
  constructor() {
    this.toastEl = DOM.get("toast");
    this.toastTimeout = null;
  }
  
  show(message, type = "info", duration = 3500) {
    if (!this.toastEl) return;
    
    clearTimeout(this.toastTimeout);
    this.toastEl.textContent = message;
    this.toastEl.className = `toast-notification ${type}`;
    this.toastEl.style.display = "flex";
    
    this.toastTimeout = setTimeout(() => {
      this.toastEl.style.display = "none";
    }, duration);
  }
  
  success(message) { this.show(message, "success", 3000); }
  error(message) { this.show(message, "error", 4000); }
  warning(message) { this.show(message, "warning", 3500); }
  info(message) { this.show(message, "info", 3000); }
}

const notify = new NotificationService();

/* ══════════════════════════════════════════════════════════════
   FORM VALIDATOR SERVICE
══════════════════════════════════════════════════════════════ */

class FormValidator {
  static validatePreinscription(formData) {
    const errors = {};
    
    if (!formData.nom?.trim()) errors.nom = 'Nom requis';
    if (!formData.prenom?.trim()) errors.prenom = 'Prenom requis';
    if (!formData.telephone?.trim()) errors.telephone = 'Telephone requis';
    if (!this.validatePhone(formData.telephone)) errors.telephone = 'Format telephone invalide';
    if (!formData.filiere?.trim()) errors.filiere = 'Filiere requise';
    if (!formData.ville?.trim()) errors.ville = 'Ville requise';
    if (!formData.etablissement?.trim()) errors.etablissement = 'Etablissement requis';
    
    return errors;
  }
  
  static validatePhone(phone) {
    if (!phone) return false;
    const regex = /^(\+225[0-9]{10}|[0-9]{10})$/;
    return regex.test(phone.replace(/[\s\-\.]/g, ''));
  }

  static normalizePhone(phone) {
    if (!phone) return '';
    let normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.startsWith('225')) {
      normalized = normalized.slice(3);
    }
    return normalized;
  }

  static normalizeText(value) {
    return value ? value.trim().toLowerCase() : '';
  }

  static displayErrors(formId, errors) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.classList.remove('error');
      input.removeAttribute('aria-invalid');
      
      const errorSpan = input.parentNode.querySelector('.form-error, .error-msg');
      if (errorSpan) {
        errorSpan.textContent = '';
      }
    });
    
    Object.keys(errors).forEach(fieldName => {
      const input = form.querySelector(`[name="${fieldName}"]`);
      if (input) {
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
        
        const errorSpan = input.parentNode.querySelector('.form-error');
        if (errorSpan) {
          errorSpan.textContent = errors[fieldName];
        } else {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-msg';
          errorDiv.textContent = errors[fieldName];
          input.parentNode.appendChild(errorDiv);
        }
      }
    });
  }
}

async function isDuplicatePreregistration(telephoneNormalized) {
  if (!telephoneNormalized) return false;

  try {
    const duplicateQuery = query(
      collection(db, 'preinscriptions'),
      where('telephoneNormalized', '==', telephoneNormalized)
    );
    const duplicateSnap = await getDocs(duplicateQuery);
    return !duplicateSnap.empty;
  } catch (error) {
    Logger.error('Erreur en vérifiant les doublons de préinscription', error);
    return false;
  }
}

function showPreregSuccess() {
  const formContent = DOM.get('formContent');
  const formSuccess = DOM.get('formSuccess');
  if (formContent && formSuccess) {
    formContent.classList.add('hidden');
    formSuccess.classList.add('active');
  }
}

function resetPreregFormUI() {
  const formContent = DOM.get('formContent');
  const formSuccess = DOM.get('formSuccess');
  if (formContent && formSuccess) {
    formContent.classList.remove('hidden');
    formSuccess.classList.remove('active');
  }
}

/* ══════════════════════════════════════════════════════════════
   FORM SERVICE
══════════════════════════════════════════════════════════════ */

class FormService {
  static getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return null;
    
    const formData = new FormData(form);
    return Object.fromEntries(formData);
  }
  
  static async submit(formId, validationFn, submitFn) {
    const formData = this.getFormData(formId);
    if (!formData) return false;
    
    const errors = validationFn(formData);
    if (Object.keys(errors).length > 0) {
      FormValidator.displayErrors(formId, errors);
      return false;
    }
    
    try {
      return await submitFn(formData);
    } catch (error) {
      Logger.error('Form submission error', error);
      return false;
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   MODAL SERVICE
══════════════════════════════════════════════════════════════ */

class ModalService {
  static open(modalId) {
    const modal = DOM.get(modalId);
    if (!modal) return;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const closeBtn = modal.querySelector('[data-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(modalId));
    }
  }
  
  static close(modalId) {
    const modal = DOM.get(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  static closeAll() {
    document.querySelectorAll('.modal-overlay.active, .modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
}

/* ══════════════════════════════════════════════════════════════
   EVENT LISTENERS & HANDLERS
══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  Logger.info('DOM loaded, initializing app');
  
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ModalService.closeAll();
    }
  });
  
  // Visitor Form Submit
  const visitorForm = document.getElementById('visitorForm');
  if (visitorForm) {
    visitorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveVisitorInfo();
    });
  }
  
  // Pre-registration Form Submit
  const preregForm = document.getElementById('preregForm');
  if (preregForm) {
    preregForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const result = await FormService.submit(
        'preregForm',
        (data) => FormValidator.validatePreinscription(data),
        async (formData) => {
          const telephoneNormalized = FormValidator.normalizePhone(formData.telephone);
          if (await isDuplicatePreregistration(telephoneNormalized)) {
            notify.warning('Ce numéro est déjà utilisé pour une préinscription. Veuillez utiliser un autre numéro.');
            return false;
          }

          try {
            const doc = await addDoc(collection(db, 'preinscriptions'), {
              ...formData,
              telephoneNormalized,
              createdAt: serverTimestamp(),
              source: 'online'
            });
            Logger.info('Pre-registration saved', { id: doc.id });
            notify.success('Préinscription confirmée !');
            preregForm.reset();
            resetPreregFormUI();
            showPreregSuccess();
            return true;
          } catch (error) {
            Logger.error('Pre-registration error', error);
            notify.error('Erreur lors de la préinscription.');
            return false;
          }
        }
      );
      
      return result;
    });
  }
  
  // Real-time form validation
  document.querySelectorAll('#preregForm input, #preregForm select').forEach(field => {
    field.addEventListener('blur', debounce(() => {
      const form = field.closest('form');
      if (!form) return;
      
      const formId = form.id;
      if (formId === FORM_IDS.prereg) {
        const formData = FormService.getFormData(formId);
        const errors = FormValidator.validatePreinscription(formData);
        if (errors[field.name]) {
          field.classList.add('error');
          field.setAttribute('aria-invalid', 'true');
        } else {
          field.classList.remove('error');
          field.removeAttribute('aria-invalid');
        }
      }
    }, 500));

    field.addEventListener('input', () => {
      field.classList.remove('error');
      field.removeAttribute('aria-invalid');
      const errorSpan = field.parentNode.querySelector('.form-error, .error-msg');
      if (errorSpan) {
        errorSpan.textContent = '';
      }
    });
  });
  
  // Modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        ModalService.close(overlay.id);
      }
    });
  });
});

// Expose for HTML onclick handlers
window.submitForm = async () => {
  const preregForm = document.getElementById('preregForm');
  if (preregForm) {
    preregForm.dispatchEvent(new Event('submit'));
  }
};

window.openWA = function () {
  forceWAFormMode = true;
  clearVisitorSavedState();
  const visitorForm = document.getElementById('visitorForm');
  if (visitorForm) {
    visitorForm.reset();
  }
  updateWAModalUI();
  ModalService.open('modalWA');
};

window.closeWA = function () {
  forceWAFormMode = false;
  ModalService.close('modalWA');
};

window.openForm = function () {
  ModalService.close('modalWA');
  ModalService.open('modalForm');
};

window.closeForm = function () {
  resetPreregFormUI();
  ModalService.close('modalForm');
};

window.skipPreinscription = function () {
  localStorage.setItem('uiya-wa-skip-preinscription', '1');
  ModalService.closeAll();
  notify.info('Pré-inscription ignorée.');
};

window.onWAClick = function (event) {
  if (!isVisitorSaved()) {
    notify.error('Veuillez d’abord enregistrer votre visite avant de rejoindre le groupe WhatsApp.');
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    return false;
  }

  markWAJoined();
  return true;
};

function handleReturnFromWhatsApp() {
  if (!shouldAutoOpenWAModal()) return;
  forceWAFormMode = false;
  updateWAModalUI();
  openWAModalOnReturn();
}

// Check saved state on page load and when user returns to the page
window.addEventListener('load', () => {
  if (isVisitorSaved()) {
    setWAJoinEnabled(true);
  }
  updateWAModalUI();
  if (shouldAutoOpenWAModal()) {
    openWAModalOnReturn();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    handleReturnFromWhatsApp();
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    handleReturnFromWhatsApp();
  }
});
