// Teste da funcionalidade de geolocalização
async function testGeolocation() {
  console.log("🧪 Testando geolocalização...");

  if (!navigator.geolocation) {
    console.error("❌ Geolocalização não suportada");
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      });
    });

    const { latitude, longitude } = position.coords;
    console.log("✅ Localização obtida:", { latitude, longitude });

    // Testar Nominatim reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
      { headers: { Accept: 'application/json' } }
    );

    const data = await response.json();
    console.log("📍 Geocoding result:", data);

    if (data.display_name) {
      console.log("✅ Endereço obtido:", data.display_name);
    } else {
      console.log("⚠️ Geocoding falhou, usando coordenadas");
    }

  } catch (error) {
    console.error("❌ Erro na geolocalização:", error);
  }
}

// Executar teste se estiver no navegador
if (typeof window !== 'undefined') {
  testGeolocation();
}