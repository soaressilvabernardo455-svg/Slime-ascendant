using UnityEngine;
namespace SlimeAscendant {
 public enum GraphicsPreset{Low,Balanced,High}
 public static class QualityPreset {
  public static void Apply(GraphicsPreset preset){switch(preset){
   case GraphicsPreset.Low:QualitySettings.SetQualityLevel(0,true);QualitySettings.shadows=ShadowQuality.Disable;QualitySettings.antiAliasing=0;Application.targetFrameRate=30;break;
   case GraphicsPreset.High:QualitySettings.SetQualityLevel(Mathf.Max(0,QualitySettings.names.Length-1),true);QualitySettings.shadows=ShadowQuality.All;QualitySettings.antiAliasing=2;Application.targetFrameRate=60;break;
   default:QualitySettings.SetQualityLevel(Mathf.Clamp(1,0,QualitySettings.names.Length-1),true);QualitySettings.shadows=ShadowQuality.HardOnly;QualitySettings.antiAliasing=2;Application.targetFrameRate=45;break;
  }}
 }
}