import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { lon, lat } = await req.json();

  try {
    const response = await fetch('https://itaipeiparking.pma.gov.taipei/MapAPI/GetAllPOIData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lon: lon.toString(),
        lat: lat.toString(),
        catagory: 'car',
        type: '3',
      }),
    });
    console.log(1222223)
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.log(12444)
    return NextResponse.json({ error: 'Error fetching parking data' }, { status: 500 });
  }
}
