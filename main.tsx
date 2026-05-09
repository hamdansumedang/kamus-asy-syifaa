@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Roboto:wght@300;400;500;700&display=swap');
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --font-sans: "Roboto", "Amiri", ui-sans-serif, system-ui, sans-serif;
  --font-arabic: "Amiri", serif;
  
  --color-primary-50: #f0fdf4;
  --color-primary-100: #dcfce7;
  --color-primary-200: #bbf7d0;
  --color-primary-300: #86efac;
  --color-primary-400: #4ade80;
  --color-primary-500: #22c55e;
  --color-primary-600: #16a34a;
  --color-primary-700: #15803d;
  --color-primary-800: #166534;
  --color-primary-900: #14532d;
}

body {
  background-color: #f8fafc; /* slate-50 */
  color: #1e293b; /* slate-800 */
}
