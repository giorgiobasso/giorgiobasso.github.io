    document.addEventListener('DOMContentLoaded', function() {
        // Select all animated links
        const links = document.querySelectorAll('.animated-text-link');

        links.forEach(link => {
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
                    span.style.animation = `typing-reveal 0.05s ease-in forwards ${index * 0.03}s`;
                });
            });

            link.addEventListener('mouseleave', () => {
                charSpans.forEach((span) => {
                    span.style.animation = 'none';
                    span.style.opacity = '0';
                    span.style.transform = 'translateX(-10px)';
                });
            });
        });
    });