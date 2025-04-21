function updateSelectedSubject(id, name, color) {
    window.selectedSubjectId = id;
    window.selectedSubjectValue = name;
    window.selectedSubjectColor = color;

    const subjectSpan = document.getElementById('selectedSubject');
    if (subjectSpan) {
        subjectSpan.innerHTML = `
            <span class="subject-color-circle" style="background-color: ${color}; margin-right: 8px;"></span>
            ${name}
        `;
        subjectSpan.classList.remove('placeholder-text');
    }

    localStorage.setItem('selectedSubjectId', id);
    localStorage.setItem('selectedSubjectValue', name);
    localStorage.setItem('selectedSubjectColor', color);
}

function resetSelectedSubject() {
    window.selectedSubjectId = null;
    window.selectedSubjectValue = null;
    window.selectedSubjectColor = null;

    const subjectSpan = document.getElementById('selectedSubject');
    if (subjectSpan) {
        subjectSpan.innerHTML = 'Select Category';
        subjectSpan.classList.add('placeholder-text');
    }

    localStorage.removeItem('selectedSubjectId');
    localStorage.removeItem('selectedSubjectValue');
    localStorage.removeItem('selectedSubjectColor');
}

function attachDropdownListeners() {
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            updateSelectedSubject(
                item.getAttribute('data-id'),
                item.getAttribute('data-value'),
                item.getAttribute('data-color')
            );
        });
    });
}

function restoreSelectedSubject() {
    const id = localStorage.getItem('selectedSubjectId');
    const name = localStorage.getItem('selectedSubjectValue');
    const color = localStorage.getItem('selectedSubjectColor');

    if (id && name && color) {
        updateSelectedSubject(id, name, color);
    } else {
        resetSelectedSubject();
    }
}
