// Modal wiring (Iteration B: behavior + accessibility only; no submit/validation/fetch yet)
const modal = document.getElementById('signup-modal');
const appRoot = document.querySelector('.app');
const modalOverlay = modal?.querySelector('.toda-modal__overlay');
const modalDialog = modal?.querySelector('.toda-modal__dialog');
const modalCloseButton = modal?.querySelector('.toda-modal__close');
const modalNameInput = document.getElementById('lead-name');
const modalForm = document.getElementById('signup-modal-form');

let lastFocusedElement = null;
let lastBodyOverflow = '';

const initChipGroups = () => {
    if (!modalForm) return;

    const groups = modalForm.querySelectorAll('[data-chip-group]');
    groups.forEach((groupEl) => {
        const group = /** @type {HTMLElement} */ (groupEl);
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

    // Autofocus name field for mobile keyboard
    if (modalNameInput && typeof modalNameInput.focus === 'function') {
        modalNameInput.focus({ preventScroll: true });
    }
};

const closeModal = () => {
    if (!modal) return;

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
