// Modal wiring (Iteration B: behavior + accessibility only; no submit/validation/fetch yet)
// DEV-only toggle to force a server error (no UI)
const FORCE_SERVER_ERROR = false;

const modal = document.getElementById('signup-modal');
const appRoot = document.querySelector('.app');
const modalOverlay = modal?.querySelector('.toda-modal__overlay');
const modalDialog = modal?.querySelector('.toda-modal__dialog');
const modalCloseButton = modal?.querySelector('.toda-modal__close');
const modalNameInput = document.getElementById('lead-name');
const modalEmailInput = document.getElementById('lead-email');
const modalConsentInput = document.getElementById('lead-consent');
const modalForm = document.getElementById('signup-modal-form');
const modalSubmitButton = modalForm?.querySelector('button[type="submit"]');
const modalGeneralError = document.getElementById('signup-modal-error');
const nameFieldError = document.getElementById('lead-name-error');
const emailFieldError = document.getElementById('lead-email-error');
const consentFieldError = document.getElementById('lead-consent-error');

const successToast = document.getElementById('signup-success-toast');
const successToastOverlay = successToast?.querySelector('.toda-toast__overlay');
const successToastCloseButton = successToast?.querySelector('.toda-toast__close');

let lastFocusedElement = null;
let lastBodyOverflow = '';
let lastBodyOverflowForToast = '';
let isSubmitting = false;
const submitButtonDefaultLabel = modalSubmitButton?.textContent || 'Absenden';

const setModalGeneralError = (message) => {
    if (!modalGeneralError) return;
    if (!message) {
        modalGeneralError.hidden = true;
        return;
    }
    modalGeneralError.innerHTML = `<strong>Oops.</strong> ${message}`;
    modalGeneralError.hidden = false;
};

const setFieldError = (el, show) => {
    if (!el) return;
    el.hidden = !show;
};

const clearModalUiState = () => {
    setModalGeneralError('');
    setFieldError(nameFieldError, false);
    setFieldError(emailFieldError, false);
    setFieldError(consentFieldError, false);

    isSubmitting = false;
    if (modalSubmitButton) {
        modalSubmitButton.disabled = false;
        modalSubmitButton.textContent = submitButtonDefaultLabel;
    }
};

const resetModalFormValues = () => {
    if (!modalForm) return;
    modalForm.reset();

    // Reset hidden chip inputs explicitly (and clear chip UI)
    const hiddenInputs = modalForm.querySelectorAll('input[type="hidden"][data-resettable], input[type="hidden"][name="segment"], input[type="hidden"][name="revenue_range"]');
    hiddenInputs.forEach((i) => {
        i.value = '';
    });

    const chips = modalForm.querySelectorAll('.toda-modal__chip');
    chips.forEach((chip) => {
        chip.classList.remove('is-active');
        chip.setAttribute('aria-pressed', 'false');
    });
};

const postLead = async (payload) => {
    const headers = { 'Content-Type': 'application/json' };
    if (FORCE_SERVER_ERROR) headers['x-force-error'] = '1';

    const res = await fetch('/.netlify/functions/lead', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    let data;
    try {
        data = await res.json();
    } catch {
        data = null;
    }

    if (!res.ok) {
        const err = new Error((data && data.message) ? data.message : 'Request failed');
        err.data = data;
        err.status = res.status;
        throw err;
    }

    return data;
};

const showSuccessToast = () => {
    if (!successToast) return;
    successToast.hidden = false;

    lastBodyOverflowForToast = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    if (successToastCloseButton && typeof successToastCloseButton.focus === 'function') {
        successToastCloseButton.focus({ preventScroll: true });
    }
};

const hideSuccessToast = () => {
    if (!successToast) return;
    successToast.hidden = true;
    document.body.style.overflow = lastBodyOverflowForToast;
};

const initChipGroups = () => {
    if (!modalForm) return;

    const groups = modalForm.querySelectorAll('[data-chip-group]');
    groups.forEach((groupEl) => {
        const group = /** @type {HTMLElement} */ (groupEl);
        if (group.dataset.chipsInitialized === 'true') {
            return;
        }
        const fieldName = group.getAttribute('data-chip-group');
        if (!fieldName) return;

        const hiddenInput = modalForm.querySelector(`input[type="hidden"][name="${fieldName}"]`);
        if (!hiddenInput) return;

        const chips = Array.from(group.querySelectorAll('.toda-modal__chip'));
        const setActive = (value) => {
            hiddenInput.value = value;
            chips.forEach((chip) => {
                const chipValue = chip.getAttribute('data-chip-value') || '';
                const isActive = chipValue === value;
                chip.classList.toggle('is-active', isActive);
                chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        };

        // Initialize from current hidden value (if any)
        setActive(hiddenInput.value || '');

        chips.forEach((chip) => {
            chip.addEventListener('click', () => {
                const value = chip.getAttribute('data-chip-value') || '';
                const isAlreadyActive = hiddenInput.value === value;
                setActive(isAlreadyActive ? '' : value);
            });
        });

        group.dataset.chipsInitialized = 'true';
    });
};

const getFocusableElements = () => {
    if (!modalDialog) return [];
    const candidates = modalDialog.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(candidates).filter((el) => {
        const element = /** @type {HTMLElement} */ (el);
        if (element.hasAttribute('disabled')) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return element.offsetParent !== null;
    });
};

const openModal = (openerEl) => {
    if (!modal) return;
    lastFocusedElement = openerEl || document.activeElement;

    modal.hidden = false;
    appRoot?.setAttribute('aria-hidden', 'true');

    lastBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    initChipGroups();
    clearModalUiState();

    // Autofocus name field for mobile keyboard
    if (modalNameInput && typeof modalNameInput.focus === 'function') {
        modalNameInput.focus({ preventScroll: true });
    }
};

const closeModal = () => {
    if (!modal) return;

    // Important: only clear error/loading state, keep user inputs unless success reset happened elsewhere
    clearModalUiState();

    modal.hidden = true;
    appRoot?.removeAttribute('aria-hidden');

    document.body.style.overflow = lastBodyOverflow;

    const toFocus = lastFocusedElement;
    lastFocusedElement = null;
    if (toFocus && typeof toFocus.focus === 'function') {
        toFocus.focus({ preventScroll: true });
    }
};

const trapFocus = (e) => {
    if (e.key !== 'Tab' || !modal || modal.hidden) return;

    const focusables = getFocusableElements();
    if (focusables.length === 0) {
        e.preventDefault();
        return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
        if (active === first || active === modalDialog) {
            e.preventDefault();
            last.focus();
        }
        return;
    }

    if (active === last) {
        e.preventDefault();
        first.focus();
    }
};

const handleGlobalKeydown = (e) => {
    if (!modal || modal.hidden) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
    }

    trapFocus(e);
};

const openFromFormSubmit = (e) => {
    e.preventDefault();
    openModal(e.submitter || e.currentTarget);
};

document.getElementById('signup-form')?.addEventListener('submit', openFromFormSubmit);
document.getElementById('signup-form-bottom')?.addEventListener('submit', openFromFormSubmit);

modalCloseButton?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', closeModal);
document.addEventListener('keydown', handleGlobalKeydown);

// Submit handling (Iteration C: validation + mock request + UX states)
modalForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    clearModalUiState();

    const name = (modalNameInput?.value || '').trim();
    const email = (modalEmailInput?.value || '').trim();
    const consentChecked = !!modalConsentInput?.checked;
    const segment = (modalForm?.querySelector('input[name="segment"]')?.value || '').trim();
    const revenueRange = (modalForm?.querySelector('input[name="revenue_range"]')?.value || '').trim();

    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    let hasError = false;
    if (!name) {
        setFieldError(nameFieldError, true);
        hasError = true;
    }
    if (!email || !emailLooksValid) {
        setFieldError(emailFieldError, true);
        hasError = true;
    }
    if (!consentChecked) {
        setFieldError(consentFieldError, true);
        hasError = true;
    }

    if (hasError) {
        setModalGeneralError('Bitte fülle die Pflichtfelder aus.');
        return;
    }

    // Submit UX state
    isSubmitting = true;
    if (modalSubmitButton) {
        modalSubmitButton.disabled = true;
        modalSubmitButton.textContent = 'Sende…';
    }

    try {
        await postLead({
            name,
            email,
            segment: segment || undefined,
            revenue_range: revenueRange || undefined,
            marketing_consent: consentChecked
        });

        // Success flow: reset form, close modal, show toast
        resetModalFormValues();
        clearModalUiState();
        closeModal();
        showSuccessToast();
    } catch (err) {
        // Error flow: keep modal open, keep user values, reset loading state and show general error
        isSubmitting = false;
        if (modalSubmitButton) {
            modalSubmitButton.disabled = false;
            modalSubmitButton.textContent = submitButtonDefaultLabel;
        }
        const serverData = err?.data;
        if (serverData?.fieldErrors) {
            setFieldError(nameFieldError, !!serverData.fieldErrors.name);
            setFieldError(emailFieldError, !!serverData.fieldErrors.email);
            setFieldError(consentFieldError, !!serverData.fieldErrors.marketing_consent);
        }
        setModalGeneralError(serverData?.message || 'Das hat leider nicht geklappt. Bitte versuche es nochmal.');
    }
});

successToastCloseButton?.addEventListener('click', hideSuccessToast);
successToastOverlay?.addEventListener('click', hideSuccessToast);

// Simple scroll reveal for features
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(card);
});
