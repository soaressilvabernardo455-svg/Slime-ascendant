using UnityEngine;
namespace SlimeAscendant {
 public sealed class MobileInput:MonoBehaviour {
  public static Vector2 Move{get;private set;}private int fingerId=-1;private Vector2 origin;[SerializeField]private float joystickRadius=105;
  private void Update(){Move=Vector2.zero;if(Input.touchCount==0){fingerId=-1;return;}for(int i=0;i<Input.touchCount;i++){Touch t=Input.GetTouch(i);if(fingerId==-1&&t.phase==TouchPhase.Began&&t.position.x<Screen.width*.55f){fingerId=t.fingerId;origin=t.position;}if(t.fingerId!=fingerId)continue;if(t.phase==TouchPhase.Ended||t.phase==TouchPhase.Canceled){fingerId=-1;Move=Vector2.zero;}else Move=Vector2.ClampMagnitude((t.position-origin)/joystickRadius,1);break;}}
 }
}