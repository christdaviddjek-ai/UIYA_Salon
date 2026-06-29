// ══════════════════════════════════════════════════════════════
//  app-improved.js  –  Code Optimisé & Maintainable
//  Services · Validation · Error Handling · Debounce
// ══════════════════════════════════════════════════════════════

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
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
    this.toastEl.className = `toast active ${type}`;
    
    this.toastTimeout = setTimeout(() => {
      this.toastEl.className = "toast";
    }, duration);
    
    Logger.info(`Toast: ${message}`, { type });
  }
  
  success(message) {
    this.show(message, "success");
  }
  
  error(message) {
    this.show(message, "error");
  }
  
  warning(message) {
    this.show(message, "warning");
  }
}

const notify = new NotificationService();

/* ══════════════════════════════════════════════════════════════
   FORM VALIDATION SERVICE
══════════════════════════════════════════════════════════════ */

class FormValidator {
  constructor() {
    this.errors = {};
  }
  
  /**
   * Valide un formulaire de pré-inscription
   */
  validatePreinscription(data) {
    this.errors = {};
    
    // Nom
    if (!data.nom || !data.nom.trim()) {
      this.errors.nom = "Nom requis";
    } else if (data.nom.length < 2) {
      this.errors.nom = "Nom doit contenir au moins 2 caractères";
    }
    
    // Prénom
    if (!data.prenom || !data.prenom.trim()) {
      this.errors.prenom = "Prénom requis";
    } else if (data.prenom.length < 2) {
      this.errors.prenom = "Prénom doit contenir au moins 2 caractères";
    }
    
    // Téléphone (format Côte d'Ivoire)
    if (!data.telephone || !data.telephone.trim()) {
      this.errors.telephone = "Téléphone requis";
    } else if (!this.validatePhone(data.telephone)) {
      this.errors.telephone = "Format de téléphone invalide";
    }
    
    // Filière
    if (!data.filiere) {
      this.errors.filiere = "Filière requise";
    }
    
    // Ville
    if (!data.ville) {
      this.errors.ville = "Ville requise";
    }
    
    // Établissement
    if (!data.etablissement || !data.etablissement.trim()) {
      this.errors.etablissement = "Établissement requis";
    } else if (data.etablissement.length < 3) {
      this.errors.etablissement = "Établissement invalide";
    }
    
    return Object.keys(this.errors).length === 0;
  }
  
  /**
   * Valide un numéro de téléphone (Côte d'Ivoire: +225 ou 07)
   */
  validatePhone(phone) {
    const cleanPhone = phone.replace(/\s+/g, '');
    const phoneRegex = /^(\+225|0)([0-9]{9,10})$/;
    return phoneRegex.test(cleanPhone);
  }
  
  /**
   * Affiche les erreurs sur le formulaire
   */
  displayErrors(formId) {
    // D'abord, enlever toutes les erreurs existantes
    DOM.qsa(`#${formId} .form-input`).forEach(input => {
      input.classList.remove("error");
    });
    
    // Afficher les nouvelles erreurs
    Object.entries(this.errors).forEach(([fieldName, errorMsg]) => {
      const input = DOM.get(fieldName);
      if (input) {
        input.classList.add("error");
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", `${fieldName}-error`);
      }
    });
  }
  
  /**
   * Nettoie les erreurs
   */
  clearErrors(formId) {
    this.errors = {};
    DOM.qsa(`#${formId} .form-input`).forEach(input => {
      input.classList.remove("error");
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
  }
}

const validator = new FormValidator();

/* ══════════════════════════════════════════════════════════════
   FORM SERVICE
══════════════════════════════════════════════════════════════ */

class FormService {
  constructor() {
    this.COLLECTION = "preinscriptions";
    this.isSubmitting = false;
  }
  
  /**
   * Récupère les données du formulaire
   */
  getFormData() {
    return {
      nom: DOM.get("nom")?.value || "",
      prenom: DOM.get("prenom")?.value || "",
      telephone: DOM.get("telephone")?.value || "",
      filiere: DOM.get("filiere")?.value || "",
      ville: DOM.get("ville")?.value || "",
      etablissement: DOM.get("etablissement")?.value || ""
    };
  }
  
  /**
   * Nettoie les données (trim + sanitization basique)
   */
  sanitizeData(data) {
    return {
      nom: data.nom.trim(),
      prenom: data.prenom.trim(),
      telephone: data.telephone.trim(),
      filiere: data.filiere,
      ville: data.ville,
      etablissement: data.etablissement.trim()
    };
  }
  
  /**
   * Réinitialise le formulaire
   */
  clearForm() {
    ["nom", "prenom", "telephone", "etablissement"].forEach(id => {
      const el = DOM.get(id);
      if (el) el.value = "";
    });
    
    const filiereEl = DOM.get("filiere");
    if (filiereEl) filiereEl.value = "";
    const villeEl = DOM.get("ville");
    if (villeEl) villeEl.value = "";
    
    validator.clearErrors("formContent");
  }
  
  /**
   * Soumet le formulaire vers Firebase
   */
  async submit() {
    if (this.isSubmitting) return;
    
    try {
      // Récupérer les données
      let data = this.getFormData();
      
      // Valider
      if (!validator.validatePreinscription(data)) {
        validator.displayErrors("formContent");
        notify.error("⚠️ Veuillez corriger les erreurs du formulaire");
        return false;
      }
      
      // Nettoyer
      data = this.sanitizeData(data);
      
      // Désactiver le bouton pendant l'envoi
      const submitBtn = DOM.qs("#formContent .submit-btn");
      if (submitBtn) {
        this.isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Envoi en cours…";
        
        try {
          // Ajouter à Firestore
          await addDoc(collection(db, this.COLLECTION), {
            ...data,
            groupeWA: false,
            statut: "en_attente",
            createdAt: serverTimestamp()
          });
          
          Logger.info("Form submitted successfully", data);
          
          // Afficher le succès
          const formContent = DOM.get("formContent");
          const formSuccess = DOM.get("formSuccess");
          
          if (formContent) formContent.style.display = "none";
          if (formSuccess) formSuccess.classList.add("active");
          
          notify.success("✅ Pré-inscription enregistrée!");
          return true;
          
        } catch (error) {
          Logger.error("Form submission error", error);
          notify.error(`❌ Erreur: ${error.message}`);
          return false;
          
        } finally {
          this.isSubmitting = false;
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitBtn.textContent = originalText;
        }
      }
      
    } catch (error) {
      Logger.error("Unexpected error", error);
      notify.error("Une erreur inattendue s'est produite");
      return false;
    }
  }
}

const formService = new FormService();

/* ══════════════════════════════════════════════════════════════
   MODAL SERVICE
══════════════════════════════════════════════════════════════ */

class ModalService {
  constructor() {
    this.activeModal = null;
  }
  
  /**
   * Ouvre un modal
   */
  open(modalId) {
    const modal = DOM.get(modalId);
    if (!modal) {
      Logger.warn(`Modal ${modalId} not found`);
      return;
    }
    
    this.activeModal = modalId;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    document.body.setAttribute("aria-hidden", "true");
    
    // Focus trap: Focus le premier élément focusable
    setTimeout(() => {
      const focusable = modal.querySelector("button, input, select");
      if (focusable) focusable.focus();
    }, 200);
  }
  
  /**
   * Ferme un modal
   */
  close(modalId) {
    const modal = DOM.get(modalId);
    if (!modal) return;
    
    this.activeModal = null;
    modal.classList.remove("active");
    document.body.style.overflow = "";
    document.body.removeAttribute("aria-hidden");
  }
  
  /**
   * Ferme tous les modals
   */
  closeAll() {
    DOM.qsa(".modal-overlay.active").forEach(overlay => {
      overlay.classList.remove("active");
    });
    document.body.style.overflow = "";
    document.body.removeAttribute("aria-hidden");
  }
}

const modal = new ModalService();

/* ══════════════════════════════════════════════════════════════
   WHATSAPP MODAL HANDLERS
══════════════════════════════════════════════════════════════ */

window.openWA = function() {
  modal.open("modalWA");
};

window.closeWA = function() {
  modal.close("modalWA");
  
  const waContent = DOM.get("waContent");
  const waSuccess = DOM.get("waSuccess");
  
  if (waContent) waContent.style.display = "block";
  if (waSuccess) waSuccess.classList.remove("active");
};

window.onWAClick = function() {
  setTimeout(() => {
    const waContent = DOM.get("waContent");
    const waSuccess = DOM.get("waSuccess");
    
    if (waContent) waContent.style.display = "none";
    if (waSuccess) waSuccess.classList.add("active");
  }, 1500);
};

/* ══════════════════════════════════════════════════════════════
   FORM MODAL HANDLERS
══════════════════════════════════════════════════════════════ */

window.openForm = function() {
  modal.open("modalForm");
  validator.clearErrors("formContent");
};

window.closeForm = function() {
  modal.close("modalForm");
  
  const formContent = DOM.get("formContent");
  const formSuccess = DOM.get("formSuccess");
  
  if (formContent) formContent.style.display = "block";
  if (formSuccess) formSuccess.classList.remove("active");
  
  formService.clearForm();
};

window.skipPreinscription = function() {
  notify.success("Merci pour votre visite. À bientôt sur l'UIYA! 👋");
};

window.submitForm = async function() {
  await formService.submit();
};

/* ══════════════════════════════════════════════════════════════
   MODAL OVERLAY CLICK HANDLING
══════════════════════════════════════════════════════════════ */

DOM.qsa(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      const modalId = overlay.id;
      if (modalId === "modalWA") window.closeWA();
      if (modalId === "modalForm") window.closeForm();
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   KEYBOARD ACCESSIBILITY
══════════════════════════════════════════════════════════════ */

// Escape key para cerrar modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    modal.closeAll();
  }
});

// Accessibility sur les cartes
DOM.qsa(".card").forEach(card => {
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.click();
    }
  });
});

// Validation en temps réel (optional)
DOM.qsa(".form-group input, .form-group select").forEach(input => {
  input.addEventListener("blur", () => {
    const data = formService.getFormData();
    if (!validator.validatePreinscription(data)) {
      validator.displayErrors("formContent");
    } else {
      validator.clearErrors("formContent");
      input.classList.remove("error");
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   INITIALIZATION
══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  Logger.info("App initialized");
  
  // Vous pouvez ajouter d'autres initialisations ici
  // Par exemple: chargement de données, configuration, etc.
});

// Export pour tests ou utilisation externe
export { FormValidator, FormService, NotificationService, ModalService, debounce };
