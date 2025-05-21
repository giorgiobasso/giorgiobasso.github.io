document.addEventListener('DOMContentLoaded', function() {
    const link = document.querySelector('.animated-text-link');

    if (link) {
        const text = link.textContent;
        link.textContent = ''; // Clear the original text

        // Wrap each character in a span
        for (let i = 0; i < text.length; i++) {
            const charSpan = document.createElement('span');
            charSpan.textContent = text[i];
            link.appendChild(charSpan);
        }

        const charSpans = link.querySelectorAll('span');

        link.addEventListener('mouseenter', () => {
            charSpans.forEach((span, index) => {
                // Apply animation with a delay based on character index
                span.style.animation = `typing-reveal 0.05s ease-in forwards ${index * 0.03}s`;
            });
        });

        link.addEventListener('mouseleave', () => {
            charSpans.forEach((span) => {
                // Reset animation properties on mouse leave
                span.style.animation = 'none'; // Stop current animation
                span.style.opacity = '0'; // Hide immediately
                span.style.transform = 'translateX(-10px)'; // Reset position
            });
        });
    }
});