import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get client IP from various headers (works with different services)
    let ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             request.headers.get('x-real-ip') ||
             request.headers.get('cf-connecting-ip') ||
             request.headers.get('x-client-ip') ||
             'unknown';

    console.log('Detected IP:', ip);

    // Try primary service first (ip-api.com)
    try {
      const res = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,query`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const data = await res.json();
      console.log('ip-api.com response:', data);

      if (data.status === 'success' && data.countryCode) {
        return NextResponse.json({
          countryCode: data.countryCode,
          countryName: data.country,
          ip: data.query,
        });
      }
    } catch (error) {
      console.error('ip-api.com error:', error);
    }

    // Fallback to ipapi.co
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const data = await res.json();
      console.log('ipapi.co response:', data);

      if (data.country_code) {
        return NextResponse.json({
          countryCode: data.country_code,
          countryName: data.country_name,
          ip: data.ip,
        });
      }
    } catch (error) {
      console.error('ipapi.co error:', error);
    }

    // If localhost/testing, return a default
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'unknown') {
      console.log('Using fallback for local/unknown IP');
      return NextResponse.json({
        countryCode: null,
        countryName: 'Local/Unknown',
        ip: ip,
      });
    }

    return NextResponse.json(
      { error: 'Unable to detect location from IP' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Location API error:', error);
    return NextResponse.json(
      { error: 'Failed to detect location' },
      { status: 500 }
    );
  }
}
