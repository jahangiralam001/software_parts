# 📱 Global Phone Number Validator

 
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
 