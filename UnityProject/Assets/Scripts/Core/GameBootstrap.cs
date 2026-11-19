using UnityEngine;
namespace SlimeAscendant {
 public sealed class GameBootstrap : MonoBehaviour {
  [SerializeField] private int startingEnemies=8; [SerializeField] private float arenaSize=34f;
  private void Start(){Application.targetFrameRate=60;CreateArena();CreatePlayer();SpawnEnemies(startingEnemies);CreateCamera();}
  private void CreateArena(){
   var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);ground.name="Arena_Ground";ground.transform.localScale=new Vector3(arenaSize/10f,1,arenaSize/10f);ground.GetComponent<Renderer>().material=Mat(new Color(.16f,.34f,.19f));
   for(int i=0;i<18;i++){Vector3 p=Random.insideUnitSphere*(arenaSize*.42f);p.y=.35f;var rock=GameObject.CreatePrimitive(PrimitiveType.Sphere);rock.name="Arena_Decoration";rock.transform.position=p;rock.transform.localScale=Vector3.one*Random.Range(.35f,1.1f);rock.GetComponent<Renderer>().material=Mat(new Color(.25f,.29f,.22f));}
   var light=new GameObject("Sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.15f;light.transform.rotation=Quaternion.Euler(50,-30,0);RenderSettings.ambientLight=new Color(.55f,.58f,.52f);
  }
  private void CreatePlayer(){var root=new GameObject("Player");root.transform.position=Vector3.zero;var motor=root.AddComponent<PlayerMotor>();motor.SetClass(PlayerClass.Knight);
   Part(root.transform,PrimitiveType.Capsule,"Torso",new Vector3(0,1.05f,0),new Vector3(.72f,.82f,.48f),new Color(.18f,.42f,.78f));
   Part(root.transform,PrimitiveType.Sphere,"Head",new Vector3(0,2.05f,0),Vector3.one*.58f,new Color(.35f,.78f,.42f));
   Part(root.transform,PrimitiveType.Capsule,"LeftArm",new Vector3(-.55f,1.1f,0),new Vector3(.24f,.55f,.24f),new Color(.35f,.78f,.42f));
   Part(root.transform,PrimitiveType.Capsule,"RightArm",new Vector3(.55f,1.1f,0),new Vector3(.24f,.55f,.24f),new Color(.35f,.78f,.42f));
   Part(root.transform,PrimitiveType.Capsule,"LeftLeg",new Vector3(-.22f,.35f,0),new Vector3(.28f,.65f,.3f),new Color(.12f,.16f,.22f));
   Part(root.transform,PrimitiveType.Capsule,"RightLeg",new Vector3(.22f,.35f,0),new Vector3(.28f,.65f,.3f),new Color(.12f,.16f,.22f));
  }
  private void SpawnEnemies(int amount){for(int i=0;i<amount;i++){Vector2 p=Random.insideUnitCircle*13f;if(p.magnitude<5)p=p.normalized*7;var e=GameObject.CreatePrimitive(PrimitiveType.Sphere);e.name="SlimeEnemy";e.transform.position=new Vector3(p.x,.65f,p.y);e.transform.localScale=new Vector3(1.15f,1.25f,1.15f);e.GetComponent<Renderer>().material=Mat(new Color(.25f,.82f,.38f));e.AddComponent<EnemyAI>();}}
  private void CreateCamera(){var go=new GameObject("Main Camera");go.tag="MainCamera";var cam=go.AddComponent<Camera>();cam.fieldOfView=55;go.AddComponent<AudioListener>();go.AddComponent<FollowCamera>();}
  private static void Part(Transform parent,PrimitiveType shape,string n,Vector3 pos,Vector3 scale,Color c){var o=GameObject.CreatePrimitive(shape);o.name=n;o.transform.SetParent(parent,false);o.transform.localPosition=pos;o.transform.localScale=scale;o.GetComponent<Renderer>().material=Mat(c);var col=o.GetComponent<Collider>();if(col!=null)Destroy(col);}
  private static Material Mat(Color c){Shader s=Shader.Find("Standard");if(s==null)s=Shader.Find("Universal Render Pipeline/Lit");var m=new Material(s);m.color=c;return m;}
 }
 public sealed class FollowCamera:MonoBehaviour{
  private Transform target;private void LateUpdate(){if(target==null){var p=FindObjectOfType<PlayerMotor>();if(p==null)return;target=p.transform;}Vector3 desired=target.position+new Vector3(0,11,-9);transform.position=Vector3.Lerp(transform.position,desired,Time.deltaTime*5);transform.LookAt(target.position+Vector3.up);}
 }
}