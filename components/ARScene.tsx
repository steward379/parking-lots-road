"use client"

import { ARCanvas, ARMarker } from '@artcom/react-three-arjs';
import {useEffect,useState,useRef} from 'react';
import { BoxGeometry } from 'three';
import { extend } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {useEffectfulState} from "@react-three/drei/helpers/useEffectfulState";

extend({ BoxGeometry });

const Model = ({ url } : {url : string}) =>{
    const { scene } = useGLTF(url);
    return <primitive object={scene} scale={[1, 1, 1]} position={[0, 0, 0]}/>;
}

export default function ARScene() {
    const [isClient, setIsClient] = useState(true);
    const domElementRef = useRef(null);
    useEffect(() => {
        // setIsClient(true);
        // if (domElementRef.current) {
        //     // Ensure the DOM element exists before modifying its style
        //     domElementRef.current.style.backgroundColor = 'blue';
        // }
    }, []);
    useEffect(() => {

        console.log('ARScene mounted');
    }, []);
    return (
       isClient && (  <div >
           <ARCanvas>
               <ambientLight intensity={0.5} />
               <directionalLight position={[0, 10, 5]} intensity={1} />
               <ARMarker type="pattern" patternUrl="./patt.hiro">
                   <mesh position={[0, 1, 0]} scale={[0.5, 0.5, 0.5]}>
                       <boxGeometry args={[1, 1, 1]} />
                       <meshBasicMaterial color="yellow" />
                       <Model url="/ball.glb" />
                   </mesh>
               </ARMarker>
           </ARCanvas>
       </div>)
    );
}
