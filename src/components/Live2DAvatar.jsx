import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

// Expose PIXI to window for pixi-live2d-display
window.PIXI = PIXI;

export default function Live2DAvatar({ audioContext, audioSource, sentiment, isSpeakingText }) {
    const canvasRef = useRef(null);
    const appRef = useRef(null);
    const modelRef = useRef(null);
    const analyzerRef = useRef(null);
    const dataArrayRef = useRef(null);

    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        // Initialize PIXI Application
        let app;
        try {
            app = new PIXI.Application({
                view: canvasRef.current,
                autoStart: true,
                transparent: true,
                backgroundAlpha: 0,
                resizeTo: canvasRef.current.parentElement
            });

            // Polyfill interaction manager for pixi-live2d-display on PixiJS v7
            if (!app.renderer.plugins.interaction) {
                app.renderer.plugins.interaction = {
                    on: () => {},
                    off: () => {},
                    destroy: () => {}
                };
            }
            if (app.renderer.events && !app.renderer.events.on) {
                app.renderer.events.on = () => {};
                app.renderer.events.off = () => {};
            }

            appRef.current = app;
        } catch (e) {
            console.error("Failed to initialize PIXI Application:", e);
            setErrorMsg(`PIXI failed to initialize: ${e.message}`);
            return;
        }

        // Define pointer tracking function at the top level of useEffect
        const onPointerMove = (event) => {
            if (modelRef.current) {
                modelRef.current.focus(event.clientX, event.clientY);
            }
        };
        window.addEventListener('pointermove', onPointerMove);

        // Load Hiyori (Cubism 3/4) model directly from Live2D official samples repo
        const modelUrl = "https://raw.githubusercontent.com/Live2D/CubismWebSamples/master/Samples/Resources/Hiyori/Hiyori.model3.json";
        
        // Dynamically import to ensure PIXI is attached to window first
        import('pixi-live2d-display').then(({ Live2DModel }) => {
            Live2DModel.from(modelUrl).then(model => {
                // In React Strict Mode, the component might unmount while the model is still loading.
                // If the app was destroyed, app.stage will be null.
                if (!appRef.current || !appRef.current.stage) {
                    model.destroy();
                    return;
                }
                
                appRef.current.stage.addChild(model);
                
                // Adjust scaling and position
                const scaleX = appRef.current.renderer.width / model.width;
                const scaleY = appRef.current.renderer.height / model.height;
                model.scale.set(Math.min(scaleX, scaleY) * 0.9); // slightly scaled down
                
                // Center the model
                model.x = (appRef.current.renderer.width - model.width * model.scale.x) / 2;
                model.y = (appRef.current.renderer.height - model.height * model.scale.y) / 2; // center vertically

                // Polyfill isInteractive for PixiJS v7 compatibility
                if (typeof model.isInteractive !== 'function') {
                    model.isInteractive = function() { return true; };
                }
                
                // Ensure all children also have it if they don't
                model.on('added', () => {
                   model.children.forEach(child => {
                       if (typeof child.isInteractive !== 'function') {
                           child.isInteractive = function() { return false; };
                       }
                   });
                });
                if (model.children) {
                   model.children.forEach(child => {
                       if (typeof child.isInteractive !== 'function') {
                           child.isInteractive = function() { return false; };
                       }
                   });
                }

                modelRef.current = model;
            }).catch(e => {
                console.error("Failed to load Live2D model:", e);
                setErrorMsg("Failed to load Live2D model.");
            });
        }).catch(e => {
            console.error("Failed to load pixi-live2d-display:", e);
            setErrorMsg("Failed to load Live2D display plugin.");
        });

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            if (appRef.current) appRef.current.destroy(true, { children: true });
        };
    }, []);

    // Helper to set parameters safely for both Cubism 2 and Cubism 3/4
    const setLive2DParam = (model, paramName2, paramName3, value) => {
        if (!model || !model.internalModel || !model.internalModel.coreModel) return;
        const coreModel = model.internalModel.coreModel;
        if (typeof coreModel.setParameterValueById === 'function') {
            coreModel.setParameterValueById(paramName3, value);
        } else if (typeof coreModel.setParamFloat === 'function') {
            coreModel.setParamFloat(paramName2, value);
        }
    };


    // Handle Sentiment Changes
    useEffect(() => {
        if (modelRef.current && sentiment) {
            // Very basic expression mapping (if the model supports it)
            // You can trigger expressions using modelRef.current.expression(index)
            // Or log to see what's available
            console.log("Sentiment changed to:", sentiment);
            
            // Just a basic example of changing parameters based on emotion
            // In a real Live2D model, you'd trigger actual .exp files
            if (modelRef.current.internalModel) {
            // E.g., make her smile if happy
            if (sentiment === 'happy') {
                setLive2DParam(modelRef.current, 'PARAM_SMILE', 'ParamSmile', 1);
            } else {
                setLive2DParam(modelRef.current, 'PARAM_SMILE', 'ParamSmile', 0);
            }
            }
        }
    }, [sentiment]);

    // Handle Lip-Sync
    useEffect(() => {
        let animationFrameId;

        if (audioContext && audioSource && modelRef.current) {
            // Real audio analysis lip-sync
            const analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256;
            audioSource.connect(analyzer);
            
            analyzerRef.current = analyzer;
            dataArrayRef.current = new Uint8Array(analyzer.frequencyBinCount);

            const updateLipSync = () => {
                if (!analyzerRef.current || !modelRef.current) return;
                
                analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
                
                let sum = 0;
                for (let i = 0; i < dataArrayRef.current.length; i++) {
                    sum += dataArrayRef.current[i];
                }
                const average = sum / dataArrayRef.current.length;
                const mouthOpen = Math.min(1.0, average / 50.0);
                
                setLive2DParam(modelRef.current, 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpenY', mouthOpen);
                
                animationFrameId = requestAnimationFrame(updateLipSync);
            };
            
            updateLipSync();
        } else if (isSpeakingText && modelRef.current) {
            // Simulated lip-sync for native TTS
            let frame = 0;
            const updateSimulatedLipSync = () => {
                frame++;
                if (!modelRef.current) return;
                
                // Create a snappy, energetic mouth movement
                // We use multiple sine waves combined with random noise to simulate syllables
                const syllableRate = frame * 0.8; 
                const sine1 = Math.sin(syllableRate) * 0.5 + 0.5;
                const sine2 = Math.sin(syllableRate * 0.4) * 0.5 + 0.5;
                
                // Add bursts of noise for consonants
                const noise = Math.random() > 0.5 ? Math.random() * 0.8 : 0;
                
                // Combine and amplify
                const mouthOpen = Math.min(1.0, (sine1 * 0.6 + sine2 * 0.4 + noise * 0.4) * 1.5);
                
                setLive2DParam(modelRef.current, 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpenY', mouthOpen);
                // Also move the jaw/head slightly when talking
                const headPitch = Math.min(1.0, (sine2 * 0.5) * 10);
                setLive2DParam(modelRef.current, 'PARAM_ANGLE_Y', 'ParamAngleY', headPitch);
                
                animationFrameId = requestAnimationFrame(updateSimulatedLipSync);
            };
            
            updateSimulatedLipSync();
        } else if (modelRef.current && modelRef.current.internalModel) {
            setLive2DParam(modelRef.current, 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpenY', 0);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [audioContext, audioSource, isSpeakingText]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: errorMsg ? 'none' : 'block' }} />
            {errorMsg && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    <p>Avatar offline</p>
                    <small>{errorMsg}</small>
                </div>
            )}
        </div>
    );
}
