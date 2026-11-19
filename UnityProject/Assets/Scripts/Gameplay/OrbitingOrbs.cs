using UnityEngine;
namespace SlimeAscendant {
 public sealed class OrbitingOrbs:MonoBehaviour {
  [SerializeField] private int orbCount=3;[SerializeField] private float radius=1.8f,rotationSpeed=125;private Transform[] orbs;private float[] hitTimers;
  private void Start(){orbs=new Transform[orbCount];hitTimers=new float[orbCount];for(int i=0;i<orbCount;i++){var o=GameObject.CreatePrimitive(PrimitiveType.Sphere);o.name="Knight_Orbit_Orb";o.transform.localScale=Vector3.one*.36f;var m=new Material(Shader.Find("Standard"));m.color=new Color(1,.72f,.16f);m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",new Color(1,.28f,.03f));o.GetComponent<Renderer>().material=m;Destroy(o.GetComponent<Collider>());orbs[i]=o.transform;}}
  private void Update(){if(orbs==null)return;for(int i=0;i<orbs.Length;i++){float a=Time.time*rotationSpeed*Mathf.Deg2Rad+i*Mathf.PI*2/orbs.Length;orbs[i].position=transform.position+new Vector3(Mathf.Cos(a)*radius,1.15f+Mathf.Sin(a*2)*.18f,Mathf.Sin(a)*radius);hitTimers[i]-=Time.deltaTime;if(hitTimers[i]<=0){foreach(var e in FindObjectsOfType<EnemyAI>()){if(e!=null&&!e.IsDead&&Vector3.Distance(orbs[i].position,e.transform.position)<.85f){e.TakeDamage(9);hitTimers[i]=.45f;break;}}}}}
  private void OnDestroy(){if(orbs!=null)foreach(var o in orbs)if(o!=null)Destroy(o.gameObject);}
 }
}