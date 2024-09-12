"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, Marker as GoogleMapMarker, InfoWindow } from '@react-google-maps/api'
import Background from 'three/src/renderers/common/Background.js';
// import { useRouter } from 'next/router';

const containerStyle = {
  width: "100vw",
  height: "100vh",
  maxWidth: "1200px", // 設定桌面版寬度限制
  margin: "0 auto", // 讓地圖在桌面版居中
  Background: "white"
};

const defaultCenter = {
  lat: 25.017341,
  lng: 121.539752
};

const libraries: ("places")[] = ["places"];

interface ParkingSpot {
  parkId: string;
  parkName: string;
  servicetime: string;
  address: string | null;
  tel: string | null;
  payex: string; //$
  carTicketPrice: string | null;
  lon: number;
  lat: number;
  carTotalNum: number;
  carRemainderNum: number;
  motorTotalNum: number;
  motorRemainderNum: number;

  busTotalNum: number;
  busRemainderNum: number;
  largeMotorTotalNum: number;
  bikeTotalNum: number;
  pregnancy_First: number;
  handicap_First: number;
  chargeStationTotalNum: number;
  chargeStation: number;

  fullRateLevel: number;

  entrance: null;
  industryId: null;
  infoType: number;
  pointMapInfo: string;

  remark: string;
  wkt: string;
  dataType: null;
  cellShareTotalNum: number;
  cellSegAvail: number;
}

function MapClient({ apiKey }: { apiKey: string }) {

  // const router = useRouter();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: libraries
  })

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'car'>('car')
  const [viewMode, setViewMode] = useState<'mapView'|'AR'>('mapView');
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [lastFetchedLocation, setLastFetchedLocation] = useState<google.maps.LatLngLiteral | null>(null);
  
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [zoomLevel, setZoomLevel] = useState<number>(15); 

  const [modalTitle, setModalTitle] = useState<string>("")
  const [modalContent, setModalContent] = useState<string>("")
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        setIsLoadingComplete(true);
      }, 1700); // 確保 Loading 至少顯示 2 秒

      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchParkingData = useCallback(async (location: google.maps.LatLngLiteral) => {
    if (!lastFetchedLocation || 
        location.lat !== lastFetchedLocation.lat || 
        location.lng !== lastFetchedLocation.lng) {


        const taipeiLatRange = [24.9, 25.2];
        const taipeiLngRange = [121.45, 121.7];

        if (location.lat < taipeiLatRange[0] || location.lat > taipeiLatRange[1] ||
          location.lng < taipeiLngRange[0] || location.lng > taipeiLngRange[1]) {
          setModalTitle("請搜尋台北市內的地點")
          setModalContent("您所在或選擇的地點不在台北市範圍內，將重設為預設位置")
          setIsModalOpen(true); // 打開 Modal
          return 
        } 
      try {
        const response = await fetch('/api/parkingData', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lon: location.lng,
            lat: location.lat,
          }),
        });

        // console.log('Fetch response status:', response.status);
        const data = await response.json();

        if (data.error){
          setModalTitle("無法取得車格資料")
          setModalContent("請稍後再試")
          setIsModalOpen(true); 
        }else {
          // console.log('Received parking data:', data);
          setParkingSpots(data);
          setLastFetchedLocation(location);
        }
      } catch (error) {
        setModalTitle("無法取得車格資料")
        setModalContent("請稍後再試")
        setIsModalOpen(true); 
        console.error("Error fetching parking data:", error);
      }
    }
  }, [lastFetchedLocation]);

  const handlePlaceSelect = useCallback(() => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const newCenter = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
  
        // 檢查是否超過台北市範圍
        const taipeiLatRange = [24.9, 25.2];
        const taipeiLngRange = [121.45, 121.7];

        if (newCenter.lat < taipeiLatRange[0] || newCenter.lat > taipeiLatRange[1] ||
          newCenter.lng < taipeiLngRange[0] || newCenter.lng > taipeiLngRange[1]) {
          setModalTitle("請搜尋台北市內的地點")
          setModalContent("您選擇的地點不在台北市範圍內，將重設為預設位置")
          setIsModalOpen(true); // 打開 Modal
        } else {
          setIsModalOpen(false);
          setModalTitle("");
          setModalContent("");
  
          setCurrentLocation(newCenter);
          setLastFetchedLocation(newCenter);
          if (map) {
            map.setCenter(newCenter);
            map.setZoom(15);
          }
          fetchParkingData(newCenter);
        }
      } else {
        console.error('Place has no geometry');
        setModalTitle("無法獲取該地點的位置")
        setModalContent("請嘗試其他搜尋關鍵字，或從下拉選單中選取")
        setIsModalOpen(true); // 打開 Modal

        
      }
    }
  }, [autocomplete, map, fetchParkingData]);

  interface ExtendedGoogleMapMouseEvent extends google.maps.MapMouseEvent {
    placeId?: string;
  }
  

  const onLoad = useCallback(function callback(map: google.maps.Map) {

    setMap(map);

    // const bounds = new window.google.maps.LatLngBounds(defaultCenter);
    // map.fitBounds(bounds);
    map.setZoom(10);
    map.setCenter(defaultCenter);

    if (inputRef.current) {
      const autocompleteInstance = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode']
      });
      setAutocomplete(autocompleteInstance);
    }
      // autocompleteInstance.addListener('place_changed', handlePlaceSelect);
      map.addListener("click", (event: ExtendedGoogleMapMouseEvent) => {
        
        if (event.placeId) {
          // 阻止預設行為
          event.stop();
      
          // 使用 PlacesService 獲取 POI 詳細信息
          const service = new google.maps.places.PlacesService(map);
          service.getDetails({ placeId: event.placeId }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry?.location) {
              const position = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };
      
              // 顯示 InfoWindow 並保持原有內容，動態插入按鈕
              if (infoWindow) infoWindow.close(); // 關閉現有的 infoWindow
              const newInfoWindow = new google.maps.InfoWindow({ position });
      
              // 使用 DOM 操作動態插入按鈕，而不替換 InfoWindow 的內容
              const contentDiv = document.createElement('div');
              contentDiv.innerHTML = `
              <div style="color: black; z-index: 5;">
                <h3 style="font-size: 16px; font-weight: bold; color: black; z-index: 5; margin-bottom: 10; max-width: 200px; word-wrap: break-word">${place.name}</h3>
                <p style="color: black; z-index: 5;">${place.formatted_address || "地址不可用"}</p>
              </div>
            `;
            
            // 創建 "查看附近車位" 按鈕
            const checkParkingButton = document.createElement('button');
            checkParkingButton.innerText = '查看附近車位';
            checkParkingButton.style.backgroundColor = '#54BAC5'; // 綠色背景
            checkParkingButton.style.border = 'none';
            checkParkingButton.style.color = 'white';
            checkParkingButton.style.padding = '5px 10px';
            checkParkingButton.style.textAlign = 'center';
            checkParkingButton.style.textDecoration = 'none';
            checkParkingButton.style.fontStyle = "bold"
            checkParkingButton.style.display = 'inline-block';
            checkParkingButton.style.fontSize = '12px';
            checkParkingButton.style.marginTop = '10px';
            checkParkingButton.style.cursor = 'pointer';
            checkParkingButton.style.borderRadius = '5px'; 

            contentDiv.appendChild(checkParkingButton);

              // 添加 "在 Google Maps 中查看" 按鈕
              const viewOnMapButton = document.createElement('button');
              viewOnMapButton.innerText = 'Google Map';
              viewOnMapButton.style.border = 'none';
              viewOnMapButton.style.color = '#4285F4';
              viewOnMapButton.style.padding = '5px 10px';
              viewOnMapButton.style.textAlign = 'center';
              viewOnMapButton.style.textDecoration = 'none';
              viewOnMapButton.style.display = 'inline-block';
              checkParkingButton.style.marginTop = '10px';
              viewOnMapButton.style.fontSize = '12px';
              viewOnMapButton.style.cursor = 'pointer';
              viewOnMapButton.style.borderRadius = '5px'; // 添加圓角

              contentDiv.appendChild(viewOnMapButton);
      
              newInfoWindow.setContent(contentDiv);
              newInfoWindow.open(map);
              setInfoWindow(newInfoWindow);
      
              // 綁定按鈕點擊事件
              google.maps.event.addListenerOnce(newInfoWindow, 'domready', () => {
                checkParkingButton.addEventListener('click', () => {
                  setCurrentLocation(position);
                  fetchParkingData(position);
                  newInfoWindow.close();
                });
              
                // "在 Google Maps 中查看" 按鈕事件
                viewOnMapButton.addEventListener('click', () => {

                  if(place.name){
                    const googleMapsURL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
                    window.open(googleMapsURL, '_blank'); // 在新標籤頁中打開 Google Maps
                  }
                });
              });
            }
          });
        }
      });
}, [handlePlaceSelect, fetchParkingData, infoWindow]);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, [handlePlaceSelect]);


  const handleLocationError = useCallback((browserHasGeolocation: boolean) => {
    console.warn(browserHasGeolocation ?
                  "Error: The Geolocation service failed." :
                  "Error: Your browser doesn't support geolocation.");
    fetchParkingData(defaultCenter);
  }, [fetchParkingData]);
  

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(pos);
          setZoomLevel(15);
          if (map) {
            map.setCenter(pos);
            map.setZoom(15);
          }
          fetchParkingData(pos);
        },
        () => {
          handleLocationError(true);
          setZoomLevel(15);
          if (map) {
            map.setZoom(15);
          }
        }
      );
    } else {
      handleLocationError(false);
      setZoomLevel(15);
      if (map) {
        map.setZoom(15);
      }
    }
  }, [fetchParkingData, handleLocationError, map]);
  

  const handleSearch = useCallback(() => {
    if (inputRef.current && inputRef.current.value.trim() !== '') {
      if (autocomplete) {
        const place = autocomplete.getPlace();

        if (place && place.geometry && place.geometry.location) {
          handlePlaceSelect();
        } else {
          // 如果使用者直接使用搜尋
          const service = new google.maps.places.PlacesService(map!);
          service.textSearch({
            query: inputRef.current.value,
            location: map?.getCenter(),
            radius: 50000 // 搜尋半徑，單位為公尺
          }, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
              const location = results[0].geometry?.location;
              if (location) {
                const newCenter = { lat: location.lat(), lng: location.lng() };
  
                 // 檢查是否超過台北市範圍
                const taipeiLatRange = [24.9, 25.2];
                const taipeiLngRange = [121.45, 121.7];

                if (newCenter.lat < taipeiLatRange[0] || newCenter.lat > taipeiLatRange[1] ||
                  newCenter.lng < taipeiLngRange[0] || newCenter.lng > taipeiLngRange[1]) {
                  setModalTitle("請搜尋台北市內的地點");
                  setModalContent("您選擇的地點不在台北市範圍內，將重設為預設位置");
                  setIsModalOpen(true);
                } else {

                  setIsModalOpen(false);
                  setModalTitle("");
                  setModalContent("");

                  setCurrentLocation(newCenter);
                  setLastFetchedLocation(newCenter);
                  
                  if (map) {
                    map.setCenter(newCenter);
                    map.setZoom(15);
                  }

                  fetchParkingData(newCenter);
                }
              }
            } else {
              console.error('Place search was not successful');
              setModalTitle("找不到該地點")
              setModalContent("請嘗試其他搜尋關鍵字，或選下拉選單中的地點")
              setIsModalOpen(true); // 打開 Modal
            }
          });
        }
      }
    } else {
      setModalTitle("請輸入搜尋關鍵字")
      setModalContent("")
      setIsModalOpen(true); // 打開 Modal
    }
  }, [autocomplete, map, fetchParkingData, handlePlaceSelect]);

  useEffect(() => {
    if (isInitialLoad) {
      getCurrentLocation();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, getCurrentLocation]);

useEffect(() => {
  if (map && currentLocation) {
    map.setCenter(currentLocation);
    map.setZoom(15);
  }
}, [map, currentLocation]);

  interface CustomMarkerProps {
    spot: ParkingSpot;
    vehicleType: 'car' | 'motorcycle';
    onMarkerClick: (spot: ParkingSpot) => void;
  }
  
  const CustomMarker: React.FC<CustomMarkerProps> = ({ spot, vehicleType, onMarkerClick }) => {
    const remainderNum = vehicleType === 'car' ? spot.carRemainderNum : spot.motorRemainderNum;
    
    // console.log(`${spot.parkName} 的標記:`, { vehicleType, remainderNum, spot });
  
    // 只在有可用車位時渲染標記
    if (remainderNum > 0) {
      return (
        <GoogleMapMarker
          position={{ lat: spot.lat, lng: spot.lon }}
          onClick={() => onMarkerClick(spot)}
          icon={{
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="#5AB4C5" />
                <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="12">${remainderNum}</text>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(40, 40)
          }}
        />
      );
    }
  
    return null;
  };

  const InfoPanel = ({ spot, onClose, vehicleType }: { spot: ParkingSpot | null, onClose: () => void, vehicleType: 'car' | 'motorcycle' }) => {
    if (!spot) return null;

    let payexWord;
    if(spot.payex.includes("元")){ payexWord = spot.payex.replace("元", "") } else if(
      spot.payex.includes("累進")){ payexWord ="累進"}

    const handleNavigation = () => {
      const googleMapsURL = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}&travelmode=driving`;
      window.open(googleMapsURL, '_blank');
    };
  
    return (
      <div
      className={`max-w-[700px] m-auto lg:rounded-3xl fixed left-0 right-0 bottom-0 lg:bottom-4 bg-white text-black p-4 shadow-lg 
                  transition-transform duration-500 ease-out transform ${spot ? 'translate-y-0' : 'translate-y-full'} 
                  opacity-${spot ? '100' : '0'} `}
      style={{ boxShadow: "0 -5px 10px rgba(0, 0, 0, 0.2)" }}
    >
        <div className="relative flex justify-center items-center px-10">
          <h2 className="text-lg font-bold">{spot.parkName}</h2>
          <button onClick={onClose} aria-label="關閉" className="text-black absolute right-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <button
            onClick={handleNavigation}
            className="absolute left-0 top-0 bg-[#5AB4C5] text-white px-4 py-2 rounded-full shadow-lg text-sm"
          >
            導航
          </button>
        </div>
        
        <div className="flex justify-center mt-1">
          <div className="border border-gray-400 rounded-md px-4 py-[1px]">
            <p className="text-sm text-center">{spot.servicetime}</p>
          </div>
        </div>

  
        {/* 車位與收費區域 */}
        <div className="flex justify-center gap-4 mt-4 ">
          {/* 車位資訊 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-full text-white font-bold">
              P
            </div>
            <p className="text-lg font-semibold">{vehicleType === 'car' ? spot.carRemainderNum : spot.motorRemainderNum}</p>
            <div className="flex items-center justify-center w-10 h-10 rounded-full text-xs text-center border p-1 border-blue-500">
              <span>剩餘<br/>車位</span>
            </div>
          </div>
  
          {/* 收費資訊 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-orange-500 rounded-full text-white font-bold text-xl">
              $
            </div>
            <p className="text-xl font-semibold">{payexWord}</p>
            <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded-xl text-xs text-center">
              <span>收費<br/>標準</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const uniqueParkingSpots = useMemo(() => {
    const uniqueSpots = new Map();
    parkingSpots.forEach(spot => {
      if (!uniqueSpots.has(spot.parkId)) {
        uniqueSpots.set(spot.parkId, spot);
      }
    });
    return Array.from(uniqueSpots.values());
  }, [parkingSpots]);

  const handleModalConfirm = () => {
    setIsModalOpen(false);
    setCurrentLocation(defaultCenter);
    setLastFetchedLocation(defaultCenter);
    if (map) {
      map.setCenter(defaultCenter);
      map.setZoom(15);
    }
  };
  
  if (!isLoadingComplete){ return <Loading /> }

  return (
    <div className="relative w-screen h-screen max-w-[1200px] mx-auto bg-gray-200">
      {/* 標題欄 */}
      <div className="fixed top-0 left-0 right-0  p-4 flex justify-between items-center z-10 shadow-md m-auto max-w-[1200px] bg-gray-200">
        <div className="w-10"></div>
        <h1 className="text-lg  text-black">猿來有車位</h1>
        <button 
          className="invisible w-7 h-7 bg-black rounded-sm flex items-center justify-center transition-transform duration-300 active:bg-white active:text-black"
          // style={{ visibility: "hidden" }}
          aria-label="關閉"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <line strokeWidth={1} x1="18" y1="6" x2="6" y2="18"></line>
            <line strokeWidth={1}  x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* 搜尋框 */}
      <div className="absolute top-[80px] left-4 right-4 z-10 max-w-[500px] m-auto ">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="請輸入地點"
            className="w-full p-3 pr-12 rounded-xl border text-black bg-white shadow-md"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <button
            onClick={handleSearch}
            className="absolute right-0 top-0 bottom-0 bg-[#5AB4C5] hover:bg-[#4A9FB0] text-white px-[13px] rounded-lg transition-colors duration-200"
            aria-label="搜尋"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 車輛類型切換按鈕 */}
      <div className="hidden absolute right-4 top-[150px] z-10">
        <div className="bg-white rounded-2xl shadow-md p-1 flex flex-col">
          <button
            className={`p-2 w-10 h-10 rounded-full transition-colors duration-300 ${
              vehicleType === 'motorcycle' ? 'bg-[#5AB4C5] text-white' : 'text-[#5AB4C5]'
            }`}
            onClick={() => setVehicleType('motorcycle')}
            aria-label="摩托車模式"
          >
            {icon_motor}
          </button>
          <button
            className={`p-2 w-10 h-10 rounded-full transition-colors duration-300 ${
              vehicleType === 'car' ? 'bg-[#5AB4C5] text-white' : 'text-[#5AB4C5]'
            }`}
            onClick={() => setVehicleType('car')}
            aria-label="汽車模式"
          >
            {icon_car}
          </button>
        </div>
      </div>

       {/* AR按鈕 */}
       <div className="hidden absolute right-4 top-[150px] z-10">
        <div className="bg-white rounded-2xl shadow-md p-1 flex flex-col">
          <button
            className={`p-2 w-10 h-10 rounded-full transition-colors duration-300 ${
              viewMode === 'mapView' ? 'bg-[#5AB4C5] text-white' : 'text-[#5AB4C5]'
            }`}
            onClick={() => setViewMode('mapView')}
            aria-label="地圖模式"
          >
            {icon_map}
          </button>
          <button
            className={`p-2 w-10 h-10 rounded-full transition-colors duration-300 ${
              viewMode === 'AR' ? 'bg-[#5AB4C5] text-white' : 'text-[#5AB4C5]'
            }`}
            onClick={() => {
              setViewMode('AR')
              // router.push('/ar');
            }}
            aria-label="AR模式"
          >
            {icon_ar}
          </button>
        </div>
      </div>

      {/* 定位按鈕 */}
      <div className="absolute left-4 top-[140px] z-10">
        <button
          onClick={getCurrentLocation}
          className="bg-white p-2 rounded-full shadow-md text-[#5AB4C5]"
          aria-label="獲取當前位置"
        >
          <div>{icon_earth} </div>
          <div className="text-xs">定位</div>
        </button>
      </div>

      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={currentLocation || defaultCenter}
        zoom={zoomLevel}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {uniqueParkingSpots.map((spot) => (
          <CustomMarker
            key={spot.parkId}
            spot={spot}
            vehicleType={vehicleType}
            onMarkerClick={setSelectedSpot}
          />
        ))}
        {currentLocation && (
          <GoogleMapMarker
            position={currentLocation}
            icon={{
              url: '/Motorbike.svg',
              scaledSize: new window.google.maps.Size(60, 60)
            }}
          />
        )}
      </GoogleMap>

      <InfoPanel vehicleType={vehicleType} spot={selectedSpot} onClose={() => setSelectedSpot(null)} />

      {isModalOpen && (
        <WarningModal
          title="請搜尋台北市內的地點"
          content="您選擇的地點不在台北市範圍內，將重設為預設位置。"
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  )
}

export default MapClient

const icon_motor =(
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 18" fill="currentColor" className="w-full h-full">
    <path d="M8.3384 0C8.69911 0 9.05999 0 9.4207 0C9.74568 0.037092 10.0715 0.0680586 10.3955 0.112467C12.6346 0.419582 14.5768 1.35369 16.2121 2.90883C18.1086 4.71255 19.22 6.94351 19.7323 9.49044C19.7688 9.67232 19.8115 9.86085 19.8005 10.0431C19.7765 10.4339 19.4573 10.7284 19.0801 10.7456C18.6753 10.7642 18.3437 10.5031 18.2734 10.0939C18.0461 8.77072 17.634 7.51248 16.9747 6.33864C16.9197 6.24098 16.8667 6.185 16.7406 6.18534C14.6212 6.18976 12.5017 6.18126 10.3824 6.19146C9.21074 6.19708 8.20772 7.13595 8.11006 8.28495C8.00661 9.50167 8.79762 10.5676 9.99171 10.7825C11.4163 11.0389 12.8451 11.2729 14.2723 11.5159C15.9276 11.7978 17.5837 12.0767 19.2383 12.3625C19.6882 12.4403 19.9528 12.8071 19.8849 13.2611C19.8071 13.7824 19.7295 14.3052 19.6172 14.8198C19.1221 17.0909 16.9386 18.3905 14.7012 17.7585C10.7904 16.6539 6.87633 15.5614 2.96993 14.4415C1.4837 14.0155 0.562016 13.0132 0.209813 11.5031C0.154856 11.2674 0.138692 11.0229 0.104492 10.7825C0.104492 10.2285 0.104492 9.67471 0.104492 9.12071C0.116232 9.03887 0.133757 8.95754 0.138692 8.87536C0.20641 7.7335 0.389488 6.6119 0.766022 5.52976C1.85581 2.4006 4.02739 0.572543 7.32466 0.112297C7.66121 0.0653363 8.00048 0.0369218 8.3384 0ZM18.2455 13.7655C18.1725 13.7485 18.123 13.7341 18.0727 13.7256C17.3494 13.6041 16.6257 13.485 15.9028 13.3625C13.8666 13.0174 11.831 12.6691 9.79451 12.3259C7.50144 11.9395 6.06422 9.65633 6.71213 7.42316C7.1865 5.78805 8.69468 4.65011 10.4128 4.64398C12.1197 4.63786 13.8268 4.64262 15.5339 4.64262C15.5992 4.64262 15.6647 4.64262 15.7301 4.64262C15.7461 4.61455 15.7619 4.58647 15.7779 4.5584C15.6263 4.42875 15.474 4.29994 15.3233 4.1691C15.0366 3.92018 14.7647 3.65169 14.4625 3.42335C12.3816 1.85154 10.0341 1.30315 7.46895 1.65621C4.8412 2.01777 3.10945 3.4863 2.24562 5.97946C1.69979 7.55451 1.58307 9.18724 1.68039 10.8387C1.74164 11.8762 2.37697 12.6557 3.37233 12.9507C3.89008 13.1042 4.41107 13.2468 4.93087 13.3936C8.34027 14.3563 11.7492 15.321 15.1596 16.2798C16.0387 16.5268 16.8168 16.3237 17.4734 15.6909C18.0128 15.1713 18.1407 14.481 18.2454 13.7655H18.2455Z" />
    <path d="M10.4229 9.27861C9.99239 9.2798 9.65141 8.94121 9.65039 8.51176C9.64937 8.08452 9.99324 7.73657 10.4179 7.73487C10.8387 7.73317 11.1933 8.08554 11.1948 8.50665C11.1962 8.93202 10.8509 9.27759 10.423 9.27861H10.4229Z" fill="#5AB4C5"/>
  </svg>
)


const icon_earth = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM8.547 4.505a8.25 8.25 0 1011.672 8.214l-.46-.46a2.252 2.252 0 01-.422-.586l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.211.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.654-.261a2.25 2.25 0 01-1.384-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.279-2.132z" clipRule="evenodd" />
</svg>
)

const icon_car = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
<path d="M6 19V20C6 20.2833 5.90417 20.5208 5.7125 20.7125C5.52083 20.9042 5.28333 21 5 21H4C3.71667 21 3.47917 20.9042 3.2875 20.7125C3.09583 20.5208 3 20.2833 3 20V12L5.1 6C5.2 5.7 5.37917 5.45833 5.6375 5.275C5.89583 5.09167 6.18333 5 6.5 5H17.5C17.8167 5 18.1042 5.09167 18.3625 5.275C18.6208 5.45833 18.8 5.7 18.9 6L21 12V20C21 20.2833 20.9042 20.5208 20.7125 20.7125C20.5208 20.9042 20.2833 21 20 21H19C18.7167 21 18.4792 20.9042 18.2875 20.7125C18.0958 20.5208 18 20.2833 18 20V19H6ZM5.8 10H18.2L17.15 7H6.85L5.8 10ZM7.5 16C7.91667 16 8.27083 15.8542 8.5625 15.5625C8.85417 15.2708 9 14.9167 9 14.5C9 14.0833 8.85417 13.7292 8.5625 13.4375C8.27083 13.1458 7.91667 13 7.5 13C7.08333 13 6.72917 13.1458 6.4375 13.4375C6.14583 13.7292 6 14.0833 6 14.5C6 14.9167 6.14583 15.2708 6.4375 15.5625C6.72917 15.8542 7.08333 16 7.5 16ZM16.5 16C16.9167 16 17.2708 15.8542 17.5625 15.5625C17.8542 15.2708 18 14.9167 18 14.5C18 14.0833 17.8542 13.7292 17.5625 13.4375C17.2708 13.1458 16.9167 13 16.5 13C16.0833 13 15.7292 13.1458 15.4375 13.4375C15.1458 13.7292 15 14.0833 15 14.5C15 14.9167 15.1458 15.2708 15.4375 15.5625C15.7292 15.8542 16.0833 16 16.5 16ZM5 17H19V12H5V17Z"/>
</svg>
)

const icon_ar = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
<g clip-path="url(#clip0_154_4068)">
<path d="M20.0167 11.4223C20.0167 12.83 20.0133 14.2379 20.0208 15.6457C20.0218 15.8279 19.9759 15.9275 19.8032 16.0132C17.2701 17.2709 14.7403 18.536 12.2127 19.8049C12.0604 19.8813 11.9432 19.8801 11.7914 19.8037C9.26455 18.5353 6.73549 17.2706 4.20307 16.0129C4.03424 15.9292 3.97949 15.8367 3.97973 15.65C3.98621 12.8343 3.98669 10.0186 3.97901 7.20323C3.97853 7.01022 4.04625 6.9274 4.21003 6.84698C6.74294 5.60683 9.27295 4.36115 11.8013 3.11164C11.9427 3.04179 12.0515 3.03578 12.1975 3.10804C14.7326 4.36188 17.2701 5.61067 19.8104 6.8537C19.9716 6.93268 20.0218 7.02318 20.0208 7.19914C20.0131 8.60686 20.0165 10.0148 20.0165 11.4225L20.0167 11.4223ZM6.87886 7.76665C6.93578 7.80434 6.95331 7.81874 6.97324 7.82858C8.60845 8.63878 10.2429 9.45043 11.882 10.2532C11.9557 10.2892 12.0825 10.2717 12.1618 10.2328C13.7657 9.44683 15.3664 8.65415 16.967 7.86195C17.0119 7.83962 17.0508 7.8053 17.1017 7.77025C17.0635 7.74432 17.0458 7.72872 17.0251 7.71839C15.3988 6.91851 13.7732 6.11647 12.1426 5.32572C12.0554 5.28347 11.9077 5.30123 11.8147 5.34588C10.8865 5.79239 9.96436 6.25091 9.04001 6.70558C8.33179 7.05391 7.6231 7.40103 6.8791 7.76641L6.87886 7.76665ZM10.9917 17.1516C10.9917 15.4709 10.9939 13.831 10.984 12.1912C10.9836 12.1206 10.8853 12.0229 10.809 11.985C9.2804 11.224 7.74846 10.4697 6.21676 9.71473C6.15432 9.68401 6.08852 9.65976 5.99654 9.62063C5.99654 9.71641 5.99654 9.78603 5.99654 9.85541C5.99654 11.3834 5.99942 12.9116 5.99221 14.4396C5.99149 14.6076 6.04529 14.6902 6.19394 14.7639C7.71988 15.5196 9.24197 16.2828 10.7653 17.0438C10.8279 17.075 10.8918 17.104 10.9917 17.1516ZM13.009 17.1432C13.0719 17.1211 13.095 17.1155 13.1157 17.1052C14.6959 16.3164 16.2746 15.5244 17.858 14.7418C17.998 14.6727 18.0059 14.5817 18.0057 14.4564C18.0037 12.9121 18.0045 11.3678 18.0037 9.82348C18.0037 9.76395 17.9951 9.70465 17.9893 9.62687C17.9324 9.65064 17.8959 9.6636 17.8616 9.68064C16.2943 10.4527 14.7285 11.2276 13.1582 11.9931C13.0196 12.0608 13.0071 12.1473 13.0073 12.2738C13.01 13.706 13.009 15.1384 13.009 16.5706C13.009 16.7528 13.009 16.935 13.009 17.1432Z" />
<path d="M1.99347 1.9817V5.98398H0.0117188V0H5.97906V1.9817H1.99347Z" />
<path d="M22.0114 1.99272H18.0205V0.00454712H23.9996V5.98348H22.0114V1.99272Z" />
<path d="M0 23.9909V18.0158H1.98775V21.9941H5.97815V23.9909H0Z" />
<path d="M23.997 24H18.02V22.0099H22.0047V18.0093H23.997V23.9998V24Z" />
</g>
<defs>
<clipPath id="clip0_154_4068">
<rect width="24" height="24" />
</clipPath>
</defs>
</svg>

)

const icon_map = (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
  <path d="M6 19V20C6 20.2833 5.90417 20.5208 5.7125 20.7125C5.52083 20.9042 5.28333 21 5 21H4C3.71667 21 3.47917 20.9042 3.2875 20.7125C3.09583 20.5208 3 20.2833 3 20V12L5.1 6C5.2 5.7 5.37917 5.45833 5.6375 5.275C5.89583 5.09167 6.18333 5 6.5 5H17.5C17.8167 5 18.1042 5.09167 18.3625 5.275C18.6208 5.45833 18.8 5.7 18.9 6L21 12V20C21 20.2833 20.9042 20.5208 20.7125 20.7125C20.5208 20.9042 20.2833 21 20 21H19C18.7167 21 18.4792 20.9042 18.2875 20.7125C18.0958 20.5208 18 20.2833 18 20V19H6ZM5.8 10H18.2L17.15 7H6.85L5.8 10ZM7.5 16C7.91667 16 8.27083 15.8542 8.5625 15.5625C8.85417 15.2708 9 14.9167 9 14.5C9 14.0833 8.85417 13.7292 8.5625 13.4375C8.27083 13.1458 7.91667 13 7.5 13C7.08333 13 6.72917 13.1458 6.4375 13.4375C6.14583 13.7292 6 14.0833 6 14.5C6 14.9167 6.14583 15.2708 6.4375 15.5625C6.72917 15.8542 7.08333 16 7.5 16ZM16.5 16C16.9167 16 17.2708 15.8542 17.5625 15.5625C17.8542 15.2708 18 14.9167 18 14.5C18 14.0833 17.8542 13.7292 17.5625 13.4375C17.2708 13.1458 16.9167 13 16.5 13C16.0833 13 15.7292 13.1458 15.4375 13.4375C15.1458 13.7292 15 14.0833 15 14.5C15 14.9167 15.1458 15.2708 15.4375 15.5625C15.7292 15.8542 16.0833 16 16.5 16ZM5 17H19V12H5V17Z" />
  </svg>)

interface WarningModalProps {
  title: string;
  content: string;
  onConfirm: () => void;
}

const WarningModal: React.FC<WarningModalProps> = ({ title, content, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white text-black p-6 rounded-lg shadow-lg w-80 text-center">
        {/* 圓形背景和驚嘆號 */}
        <div className="flex justify-center mb-4">
          <div className="bg-yellow-400 w-12 h-12 flex items-center justify-center rounded-full">
            <span className="text-white text-2xl font-bold">!</span>
          </div>
        </div>

        {/* 標題 */}
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        
        {/* 內容 */}
        <p className="mb-6 text-sm">{content}</p>

        {/* 按鈕 */}
        <button
          onClick={onConfirm}
          className="bg-[#5AB4C5] text-white px-3 py-2 rounded w-full"
        >
          確定
        </button>
      </div>
    </div>
  );
};

const Loading: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-700">
      {/* 外層容器控制寬高比例，確保影片在螢幕中顯示 */}
      <div className="relative w-full h-full aspect-video">
        <video
          className="absolute inset-0 w-full h-full object-contain"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/monkeyMagic.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      {/* <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <p className="text-white text-lg font-bold">載入中，請稍候...</p>
      </div> */}
    </div>
  );
};
