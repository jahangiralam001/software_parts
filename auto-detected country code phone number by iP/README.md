# 📱 Global Phone Number Validator

A **free, open-source, client-side phone number validator** with auto-detected country selection based on user IP address. Built with Next.js, React, and Google's `libphonenumber-js`.

**Live Demo**: [Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyouruser%2Fphone-validator)

---

## ✨ Features

✓ **Auto-detect country** from user IP address  
✓ **Real-time validation** with format guidance  
✓ **Global coverage** - Validates 190+ countries  
✓ **Country-specific rules** - Catches edge cases libphonenumber misses  
✓ **Intelligent warnings** - Alert users about too many digits *before* validation  
✓ **Zero dependencies on paid APIs** - Fully open-source  
✓ **Fast & lightweight** - All validation happens client-side  
✓ **Privacy-friendly** - No phone data sent to servers  
✓ **Beautiful UI** - Responsive, modern design  

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
git clone https://github.com/yourusername/phone-validator.git
cd auto-detected-country-code-phone-number-by-iP
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

---

## 📋 How It Works

### Validation Layers

The validator uses a **4-layer approach** for maximum accuracy:

```
┌─────────────────────────────────────────────┐
│ Layer 1: libphonenumber-js (Base Check)     │
│ - Format, length, basic country rules       │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Layer 2: Country-Specific Rules             │
│ - BD: Must start with 1                     │
│ - US: Rejects reserved 555, area codes      │
│ - IN: Must start with 6-9                   │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Layer 3: Number Type Validation             │
│ - Accepts: MOBILE, FIXED_LINE               │
│ - Rejects: VOIP, PREMIUM_RATE, etc.         │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Layer 4: Length Warnings (Real-time)        │
│ - Alerts when user enters too many digits   │
│ - Country-aware defaults                    │
└─────────────────────────────────────────────┘
```

### Example: Bangladesh Validation

```javascript
Input: +880 6475 633562

❌ INVALID
Reason: Bangladesh mobile numbers must start with 1
Format: +880 1XXX-XXXXXX
Example: +880 1813456789
```

---

## 📂 Project Structure

```
.
├── app/
│   ├── page.tsx           # Main validator page
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   └── api/
│       └── location/
│           └── route.ts   # IP geolocation endpoint
├── lib/
│   ├── countryPrefixes.ts      # Country codes & flags
│   ├── countryPhoneFormats.ts  # Format specs per country
│   └── countryValidationRules.ts (future) # Custom rules
├── public/
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## 🌍 Supported Countries

**Full coverage**: 190+ countries via libphonenumber-js

**Enhanced validation (custom rules)**:
- 🇧🇩 Bangladesh (must start with 1)
- 🇺🇸 United States (reserved codes, format rules)
- 🇮🇳 India (must start with 6-9)
- 🇬🇧 United Kingdom (format validation)
- 🇨🇳 China (11 digits, mobile format)
- 🇷🇺 Russia (9-11 digits, regional patterns)
- 🇧🇷 Brazil (10-11 digits)
- 🇲🇽 Mexico (10 digits)
- 🇯🇵 Japan (area code rules)
- 🇦🇺 Australia (format validation)
- 🇰🇷 South Korea (10 digits, 10-1x format)

### Adding New Country Rules

Edit `lib/countryValidationRules.ts`:

```typescript
{
  countryCode: "YourCountry",
  name: "Your Country Name",
  rules: [
    {
      check: (nationalNumber) => {
        // Return TRUE if INVALID
        return !nationalNumber.startsWith("1");
      },
      reason: "Your Country: must start with 1",
    },
  ],
},
```

---

## 🔧 Configuration

### Environment Variables

Create `.env.local` (optional):

```bash
# For custom IP geolocation service (optional)
NEXT_PUBLIC_GEOLOCATION_API=your_api_key
```

### IP Geolocation

By default, uses:
1. **Server-side**: Multiple fallback services (ip-api.com, ipapi.co)
2. **Client-side fallback**: ipinfo.io (when server can't detect)

---

## 📊 Validation Examples

### Valid Numbers
```
✅ +1 (202) 555-0173        (US - valid pattern)
✅ +880 1813456789          (BD - starts with 1)
✅ +91 98765 43210          (India - starts with 9)
✅ +44 2071 838750          (UK - valid pattern)
✅ +86 186 1234 5678        (China - 11 digits, starts with 1)
```

### Invalid Numbers
```
❌ +880 6475 633562         (BD - doesn't start with 1)
❌ +1 (555) 123-4567        (US - reserved 555)
❌ +91 51234 56789          (India - starts with 5, not 6-9)
❌ +86 12345 67890          (China - wrong format)
❌ 123456789                (No country selected)
```

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t phone-validator .
docker run -p 3000:3000 phone-validator
```

### Traditional Server (Ubuntu/Debian)

```bash
# Clone and setup
git clone <repo>
cd phone-validator
npm install
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start npm --name "phone-validator" -- start
pm2 save
pm2 startup
```

---

## 🧪 Testing

### Manual Testing (Recommended)

Use the UI at `http://localhost:3000` and test against:

**Bangladesh (Test Missing Start with 1)**
```
+880 6475 633562  → Should show INVALID
+880 1813456789   → Should show VALID
```

**United States (Test Reserved Codes)**
```
+1 (555) 123-4567 → Should show INVALID (555 reserved)
+1 (202) 123-4567 → Should show VALID
```

**India (Test First Digit Rules)**
```
+91 51234 56789   → Should show INVALID (starts with 5)
+91 98765 43210   → Should show VALID (starts with 9)
```

### Automated Testing (Future)

```bash
npm run test
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Next.js 14** | React framework, SSR |
| **React 18** | UI components |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **libphonenumber-js** | Phone parsing & validation |
| **world-countries** | Country data & flags |

---

## 📈 Accuracy

- **Without paid services**: ~85-90% accuracy (libphonenumber + country rules)
- **With optional HLR lookup**: ~99% accuracy (requires paid API)

### Why Not 100% Free HLR?

HLR (Home Location Register) lookup requires checking with live carrier networks, which:
- Costs $0.01-0.05 per validation
- Requires external API integration
- Not feasible for truly free, open-source tool

---

## 🤝 Contributing

We welcome contributions! There are several ways to help:

### 1. Add Country Validation Rules

See [CONTRIBUTING.md](#) for detailed guide.

**Example PR**: Add rules for your country
```typescript
// lib/countryValidationRules.ts
{
  countryCode: "YourCountry",
  rules: [ /* your rules */ ],
},
```

### 2. Improve Documentation

Fix typos, clarify instructions, add examples.

### 3. Report Issues

Found a bug? [Open an issue](https://github.com/yourusername/phone-validator/issues)

Include:
- Country code
- Phone number tested
- Expected vs actual result
- Browser/device info

### 4. Test & Feedback

Test in your region, report accuracy improvements.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🔗 Resources

- [libphonenumber-js Docs](https://github.com/catamphetamine/libphonenumber-js)
- [Country Calling Codes](https://en.wikipedia.org/wiki/List_of_country_calling_codes)
- [E.164 Standard](https://en.wikipedia.org/wiki/E.164)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 📞 Support

- 📧 Email: your-email@example.com
- 💬 GitHub Issues: [Report Bug](https://github.com/yourusername/phone-validator/issues/new)
- 🐦 Twitter: [@yourhandle](https://twitter.com)

---

## 🎯 Roadmap

- [ ] Optional HLR lookup integration (paid API toggle)
- [ ] OTP/SMS verification flow
- [ ] Bulk validation API endpoint
- [ ] REST API for external integrations
- [ ] Multi-language UI
- [ ] Automated country rule testing
- [ ] Analytics dashboard
- [ ] Mobile app (React Native)

---

## 👤 Author

**Created with ❤️ for the open-source community**

---

**Made for developers, by developers. Validate globally, validate freely.** 🌍✨
